import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, getUserProfile, type UserProfile } from '../services/authService';
import { getUserSubscription, type Subscription } from '../services/subscriptionService';
import { initializeUserSettings } from '../services/settingsService';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  subscription: Subscription | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (currentUser: User | null) => {
    if (currentUser) {
      await initializeUserSettings(currentUser.id);
      await ensureUserHasSubscription(currentUser.id);

      const [userProfile, userSubscription] = await Promise.all([
        getUserProfile(currentUser.id),
        getUserSubscription(currentUser.id),
      ]);
      setProfile(userProfile);
      setSubscription(userSubscription);
    } else {
      setProfile(null);
      setSubscription(null);
    }
  };

  const ensureUserHasSubscription = async (userId: string) => {
    try {
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (!existingSubscription) {
        const { data: freePlan } = await supabase
          .from('plans')
          .select('id')
          .eq('name', 'free')
          .single();

        if (freePlan) {
          await supabase.from('subscriptions').insert({
            user_id: userId,
            plan_id: freePlan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            credits_used: 0,
          });
        }
      }
    } catch (error) {
      console.error('Error ensuring user subscription:', error);
    }
  };

  const refreshUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    await loadUserData(currentUser);
  };

  const refreshSubscription = async () => {
    if (user) {
      const userSubscription = await getUserSubscription(user.id);
      setSubscription(userSubscription);
    }
  };

  useEffect(() => {
    getCurrentUser().then(async (currentUser) => {
      setUser(currentUser);
      await loadUserData(currentUser);
      setLoading(false);
    });

    const subscription = onAuthStateChange(async (currentUser) => {
      setUser(currentUser);
      await loadUserData(currentUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, subscription, loading, refreshUser, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
