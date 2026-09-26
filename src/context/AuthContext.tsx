import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole } from '../types';
import { appStore } from '../services/store';
import { supabase } from '../services/supabase';

interface AuthResponse {
  success: boolean;
  error?: string;
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
  login: (email: string, password?: string, desiredRole?: UserRole) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  switchUser: (profileId: string) => void;
  updateCurrentUser: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(appStore.getState().currentProfile);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Subscribe to store state changes
  useEffect(() => {
    const unsubscribe = appStore.subscribe(() => {
      setUser(appStore.getState().currentProfile);
    });
    return unsubscribe;
  }, []);

  // Hydrate auth session from Supabase on mount and listen to auth changes
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            appStore.updateProfile(profile);
            appStore.switchProfile(profile.id);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Session hydration note:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          appStore.updateProfile(profile);
          appStore.switchProfile(profile.id);
        }
      } else if (event === 'SIGNED_OUT') {
        const defaultProfile = appStore.getState().profiles[0];
        if (defaultProfile) {
          appStore.switchProfile(defaultProfile.id);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password?: string, desiredRole: UserRole = 'JOB_SEEKER'): Promise<AuthResponse> => {
    const cleanEmail = email.trim();
    // Default fallback passwords for demo seeded accounts
    let effectivePassword = password;
    if (!effectivePassword) {
      if (cleanEmail.toLowerCase() === 'karthik@cloudscale.io') {
        effectivePassword = 'RecruiterPassword123!';
      } else if (cleanEmail.toLowerCase() === 'samarth.mn@example.com') {
        effectivePassword = 'CandidatePassword123!';
      } else {
        effectivePassword = 'CandidatePassword123!';
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: effectivePassword,
      });

      if (error) {
        // Fallback for offline or local preview
        const existingLocal = appStore.getState().profiles.find((p) => p.email.toLowerCase() === cleanEmail.toLowerCase());
        if (existingLocal) {
          appStore.switchProfile(existingLocal.id);
          return { success: true };
        }
        return { success: false, error: error.message };
      }

      if (data?.user) {
        // Query user's real profile from Supabase
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile && !profErr) {
          // Add or update in store
          appStore.updateProfile(profile);
          appStore.switchProfile(profile.id);
        } else {
          // If profile hasn't populated yet, create a local representation
          const fallbackProfile: Profile = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            full_name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            role: (data.user.user_metadata?.role as UserRole) || desiredRole,
            experience_years: desiredRole === 'JOB_SEEKER' ? 2 : 5,
            availability: 'IMMEDIATELY',
            preferred_job_type: 'FULL_TIME',
            preferred_location: 'HYBRID',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          appStore.updateProfile(fallbackProfile);
          appStore.switchProfile(fallbackProfile.id);
        }

        return { success: true };
      }

      return { success: false, error: 'Authentication failed. Please verify your credentials.' };
    } catch (err: any) {
      console.error('[AuthContext] Login error:', err);
      return { success: false, error: err.message || 'An unexpected error occurred during login.' };
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
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: registerRole,
            company_name: companyName?.trim() || `${fullName.trim()}'s Team`,
          },
        },
      });

      if (signUpError) {
        return { success: false, error: signUpError.message };
      }

      // Automatically sign in to establish the authenticated session
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        return { success: false, error: signInError.message };
      }

      const activeUserId = signInData?.user?.id || signUpData?.user?.id;
      if (activeUserId) {
        // Give database trigger a tiny moment to finish writing public.profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', activeUserId)
          .single();

        if (profile) {
          appStore.updateProfile(profile);
          appStore.switchProfile(profile.id);
        } else {
          const newProfile: Profile = {
            id: activeUserId,
            email: cleanEmail,
            full_name: fullName.trim(),
            role: registerRole,
            experience_years: registerRole === 'JOB_SEEKER' ? 1 : 4,
            availability: 'IMMEDIATELY',
            preferred_job_type: 'FULL_TIME',
            preferred_location: 'HYBRID',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          appStore.updateProfile(newProfile);
          appStore.switchProfile(newProfile.id);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('[AuthContext] Registration error:', err);
      return { success: false, error: err.message || 'An unexpected error occurred during registration.' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Sign out note:', err);
    }
    const firstCand = appStore.getState().profiles[0];
    if (firstCand) appStore.switchProfile(firstCand.id);
  };

  const switchRole = (newRole: UserRole) => {
    const target = appStore.getState().profiles.find((p) => p.role === newRole);
    if (target) {
      appStore.switchProfile(target.id);
    } else if (user) {
      appStore.updateProfile({ role: newRole });
    }
  };

  const switchUser = (profileId: string) => {
    appStore.switchProfile(profileId);
  };

  const updateCurrentUser = async (data: Partial<Profile>) => {
    appStore.updateProfile(data);
    const cur = appStore.getState().currentProfile;
    if (cur?.id) {
      try {
        await supabase.from('profiles').update(data).eq('id', cur.id);
      } catch (err) {
        console.warn('[AuthContext] Supabase profile sync warning:', err);
      }
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
        switchRole,
        switchUser,
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
