import { supabase } from '../lib/supabase';
import type { Subscription, Plan } from './subscriptionService';

export interface UserWithSubscription {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  created_at: string;
  is_admin: boolean;
  subscription: Subscription | null;
}

export async function getAllUsers(): Promise<UserWithSubscription[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    throw profilesError;
  }

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('Error fetching auth users:', usersError);
    throw usersError;
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:plans(*)
    `)
    .eq('status', 'active');

  if (subsError) {
    console.error('Error fetching subscriptions:', subsError);
  }

  const subscriptionsMap = new Map(
    (subscriptions || []).map(sub => [sub.user_id, sub])
  );

  const usersMap = new Map(
    users.map(user => [user.id, user])
  );

  return profiles.map(profile => {
    const authUser = usersMap.get(profile.id);
    return {
      id: profile.id,
      email: authUser?.email || 'N/A',
      full_name: profile.full_name,
      company_name: profile.company_name,
      created_at: profile.created_at,
      is_admin: profile.is_admin || false,
      subscription: subscriptionsMap.get(profile.id) || null,
    };
  });
}

export async function updateUserSubscription(
  userId: string,
  planId: string,
  adminId: string
): Promise<void> {
  const { data: currentSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (currentSubscription) {
    await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentSubscription.id);
  }

  await supabase.from('subscriptions').insert({
    user_id: userId,
    plan_id: planId,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    credits_used: 0,
    managed_by: adminId,
  });
}

export async function toggleUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId);

  if (error) throw error;
}

export async function resetUserCredits(userId: string): Promise<void> {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!subscription) {
    throw new Error('Assinatura ativa não encontrada');
  }

  await supabase
    .from('subscriptions')
    .update({
      credits_used: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);
}

export async function extendSubscription(userId: string, days: number): Promise<void> {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!subscription) {
    throw new Error('Assinatura ativa não encontrada');
  }

  const currentEnd = new Date(subscription.current_period_end);
  const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

  await supabase
    .from('subscriptions')
    .update({
      current_period_end: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'active');
}
