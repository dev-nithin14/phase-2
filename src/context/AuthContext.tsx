import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole } from '../types';
import { isSupabaseConfigured, supabase } from '../services/supabase';

interface AuthResponse {
  success: boolean;
  error?: string;
  role?: UserRole;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  companyName?: string;
}

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  updateCurrentUser: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Hydrate auth session from Supabase on mount and listen to auth changes
  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
          if (isMounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (profile) {
          setUser(profile as Profile);
        } else {
          // Fallback from session metadata if profile row has not yet been created
          const meta = session.user.user_metadata || {};
          const fallbackRole: UserRole = (meta.role as UserRole) || 'JOB_SEEKER';
          const fallbackProfile: Profile = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: meta.full_name || session.user.email?.split('@')[0] || 'User',
            role: fallbackRole,
            experience_years: 0,
            availability: 'IMMEDIATELY',
            preferred_job_type: 'FULL_TIME',
            preferred_location: 'HYBRID',
            certifications: [],
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: session.user.updated_at || new Date().toISOString(),
          };

          void supabase.from('profiles').upsert(fallbackProfile);
          setUser(fallbackProfile);
        }
      } catch (err) {
        console.error('[AuthContext] Session hydration error:', err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void syncSession();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Please enter both email and password.' };
    }
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Unable to connect to the server. Please check your configuration and try again.' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const msg = error.message || '';
        if (msg.toLowerCase().includes('invalid login credentials')) {
          return { success: false, error: 'Invalid email or password.' };
        }
        if (msg.toLowerCase().includes('email not confirmed')) {
          return { success: false, error: 'Please confirm your email address before signing in.' };
        }
        if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || error.status === 0) {
          return { success: false, error: 'Unable to connect to the server. Please try again.' };
        }
        return { success: false, error: msg || 'Sign in failed. Check your email and password.' };
      }

      if (data?.user) {
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile) {
          // Self-heal profile from user_metadata
          const meta = data.user.user_metadata || {};
          const fallbackRole: UserRole = (meta.role as UserRole) || 'JOB_SEEKER';
          const newProfile: Partial<Profile> = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            full_name: meta.full_name || cleanEmail.split('@')[0] || 'User',
            role: fallbackRole,
            experience_years: 0,
            availability: 'IMMEDIATELY',
            preferred_job_type: 'FULL_TIME',
            preferred_location: 'HYBRID',
            certifications: [],
          };
          const { data: insertedProfile } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select('*')
            .maybeSingle();
          profile = insertedProfile || (newProfile as Profile);
        }

        setUser(profile as Profile);
        return { success: true, role: profile.role as UserRole };
      }

      return { success: false, error: 'Invalid email or password.' };
    } catch (err: unknown) {
      console.error('[AuthContext] Login error:', err);
      const isNetwork = err instanceof TypeError || (err instanceof Error && err.message.toLowerCase().includes('fetch'));
      return { 
        success: false, 
        error: isNetwork 
          ? 'Unable to connect to the server. Please try again.' 
          : err instanceof Error ? err.message : 'An unexpected error occurred during login.' 
      };
    }
  };

  const register = async ({
    email,
    password,
    fullName,
    role: registerRole,
    companyName,
  }: RegisterData): Promise<AuthResponse> => {
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();
    const cleanCompany = companyName?.trim() || `${cleanName}'s Team`;

    if (!cleanEmail || !password || !cleanName) {
      return { success: false, error: 'Please fill in all required fields.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Unable to connect to the server. Please check your configuration and try again.' };
    }

    try {
      // 1. Proactive check in profiles table for duplicate email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        return { success: false, error: 'An account with this email already exists.' };
      }

      // 2. Perform Supabase Auth SignUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            role: registerRole,
            company_name: cleanCompany,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message || '';
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already exists')) {
          return { success: false, error: 'An account with this email already exists.' };
        }
        if (msg.toLowerCase().includes('fetch') || signUpError.status === 0) {
          return { success: false, error: 'Unable to connect to the server. Please try again.' };
        }
        return { success: false, error: msg };
      }

      // 3. Supabase Auth enumeration protection check:
      // When a user already exists, Supabase Auth returns an empty identities array without throwing an error
      if (signUpData?.user?.identities && signUpData.user.identities.length === 0) {
        return { success: false, error: 'An account with this email already exists.' };
      }

      // 4. Ensure we have an active session
      let activeUser = signUpData?.user;
      if (!signUpData?.session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes('email not confirmed')) {
            return {
              success: true,
              role: registerRole,
              error: 'Account created! Please check your email to confirm your account before logging in.',
            };
          }
          if (signInError.message.toLowerCase().includes('invalid login credentials')) {
            return { success: false, error: 'An account with this email already exists.' };
          }
          return { success: false, error: signInError.message };
        }
        if (signInData?.user) {
          activeUser = signInData.user;
        }
      }

      const activeUserId = activeUser?.id;
      if (!activeUserId) {
        return { success: false, error: 'Account created, but the session could not be established. Please sign in.' };
      }

      // 5. Ensure profile row is persisted in public.profiles
      const profilePayload: Partial<Profile> = {
        id: activeUserId,
        email: cleanEmail,
        full_name: cleanName,
        role: registerRole,
        experience_years: 0,
        availability: 'IMMEDIATELY',
        preferred_job_type: 'FULL_TIME',
        preferred_location: 'HYBRID',
        certifications: [],
      };

      const { data: upsertedProfile } = await supabase
        .from('profiles')
        .upsert(profilePayload)
        .select('*')
        .maybeSingle();

      const finalProfile = upsertedProfile || (profilePayload as Profile);

      // 6. If Recruiter, ensure company is created in public.companies
      if (registerRole === 'RECRUITER') {
        try {
          const { data: existingCompany } = await supabase
            .from('companies')
            .select('id')
            .eq('recruiter_id', activeUserId)
            .maybeSingle();

          if (!existingCompany) {
            await supabase.from('companies').insert({
              recruiter_id: activeUserId,
              name: cleanCompany,
              industry: 'Technology',
              company_size: '11-50',
            });
          }
        } catch (companyErr) {
          console.warn('[AuthContext] Company creation warning:', companyErr);
        }
      }

      setUser(finalProfile as Profile);
      return { success: true, role: registerRole };
    } catch (err: unknown) {
      console.error('[AuthContext] Registration error:', err);
      const isNetwork = err instanceof TypeError || (err instanceof Error && err.message.toLowerCase().includes('fetch'));
      return { 
        success: false, 
        error: isNetwork 
          ? 'Unable to connect to the server. Please try again.' 
          : err instanceof Error ? err.message : 'An unexpected error occurred during registration.' 
      };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[AuthContext] SignOut error:', error);
    } finally {
      setUser(null);
    }
  };

  const updateCurrentUser = async (data: Partial<Profile>) => {
    if (!user) return;
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    if (profile) {
      setUser(profile as Profile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'JOB_SEEKER',
        isLoggedIn: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
