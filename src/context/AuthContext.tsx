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
    let profileRequest = 0;
    let authRevision = 0;

    const loadProfile = async (userId: string) => {
      const request = ++profileRequest;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!isMounted || request !== profileRequest) return;
        setUser(error ? null : data as Profile);
      } catch (err) {
        if (!isMounted || request !== profileRequest) return;
        console.error('[AuthContext] Profile hydration failed:', err);
        setUser(null);
      } finally {
        if (isMounted && request === profileRequest) setIsLoading(false);
      }
    };

    const initAuth = async () => {
      const observedRevision = authRevision;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted || observedRevision !== authRevision) return;
        if (session?.user) await loadProfile(session.user.id);
        else {
          setUser(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[AuthContext] Session hydration failed:', err);
        if (isMounted && observedRevision === authRevision) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision += 1;
      if (session?.user) {
        setIsLoading(true);
        void loadProfile(session.user.id);
      }
      else {
        profileRequest += 1;
        setUser(null);
        setIsLoading(false);
      }
    });

    void initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const cleanEmail = email.trim();
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured. Add the project URL and public key to the environment before signing in.' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setUser(null);
          return { success: false, error: 'Your account profile could not be loaded. Please contact support.' };
        }

        setUser(profile as Profile);
        return { success: true, role: profile.role as UserRole };
      }

      return { success: false, error: 'Authentication failed. Please verify your credentials.' };
    } catch (err: unknown) {
      console.error('[AuthContext] Login error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'An unexpected error occurred during login.' };
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
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase is not configured. Add the project URL and public key to the environment before creating an account.' };
    }
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

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        return { success: false, error: signInError.message };
      }

      const activeUserId = signInData?.user?.id || signUpData?.user?.id;
      if (!activeUserId) {
        return { success: false, error: 'Account created, but the authenticated user could not be loaded.' };
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', activeUserId)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        return { success: false, error: 'Account created, but its profile is not available yet. Please sign in again shortly.' };
      }

      setUser(profile as Profile);
      return { success: true, role: profile.role as UserRole };
    } catch (err: unknown) {
      console.error('[AuthContext] Registration error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'An unexpected error occurred during registration.' };
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
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
