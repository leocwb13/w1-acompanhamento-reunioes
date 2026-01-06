import { supabase } from '../lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { initializeUserSettings } from './settingsService';

export interface UserProfile {
  id: string;
  full_name: string;
  company_name: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signUp({ email, password, fullName, companyName }: SignUpData): Promise<{ user: User | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        company_name: companyName || null,
      }
    }
  });

  if (error) {
    return { user: null, error };
  }

  if (data.user) {
    try {
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: data.user.id,
        full_name: fullName,
        company_name: companyName || null,
      });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
      }

      const { data: freePlan, error: planError } = await supabase
        .from('plans')
        .select('id')
        .eq('name', 'free')
        .maybeSingle();

      if (planError) {
        console.error('Error fetching free plan:', planError);
      }

      if (freePlan?.id) {
        const { error: subscriptionError } = await supabase.from('subscriptions').insert({
          user_id: data.user.id,
          plan_id: freePlan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          credits_used: 0,
        });

        if (subscriptionError) {
          console.error('Error creating subscription:', subscriptionError);
        }
      } else {
        console.error('Free plan not found for user:', data.user.id);
      }

      await initializeUserSettings(data.user.id);
    } catch (err) {
      console.error('Error during sign up process:', err);
    }
  }

  return { user: data.user, error: null };
}

export async function signIn({ email, password }: SignInData): Promise<{ user: User | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error };
  }

  if (data.user) {
    await initializeUserSettings(data.user.id);
    await ensureUserSubscription(data.user.id);
  }

  return { user: data.user, error: null };
}

async function ensureUserSubscription(userId: string): Promise<void> {
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
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { error };
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

export async function updateUserProfile(userId: string, updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });

  return subscription;
}
