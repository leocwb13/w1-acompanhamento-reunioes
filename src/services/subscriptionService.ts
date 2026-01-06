import { supabase } from '../lib/supabase';

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  currency: string;
  credits_per_month: number | null;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  current_period_start: string;
  current_period_end: string;
  credits_used: number;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  payment_provider_id: string | null;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export interface UsageLog {
  id: string;
  user_id: string;
  subscription_id: string | null;
  action_type: string;
  credits_consumed: number;
  metadata: any;
  created_at: string;
}

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly');

  if (error) {
    console.error('Error fetching plans:', error);
    throw error;
  }

  return data || [];
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:plans(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user subscription:', error);
    return null;
  }

  return data;
}

export async function canUseCredits(userId: string): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return { allowed: false, reason: 'Nenhuma assinatura ativa encontrada' };
  }

  if (subscription.plan?.credits_per_month === null) {
    return { allowed: true };
  }

  const creditsLimit = subscription.plan.credits_per_month || 0;
  const creditsUsed = subscription.credits_used || 0;
  const remaining = creditsLimit - creditsUsed;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: 'Você atingiu o limite de créditos do seu plano. Faça upgrade para continuar.',
      remaining: 0
    };
  }

  return { allowed: true, remaining };
}

export async function consumeCredit(userId: string, actionType: string, metadata: any = {}): Promise<void> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    throw new Error('Nenhuma assinatura ativa encontrada');
  }

  const { allowed } = await canUseCredits(userId);
  if (!allowed) {
    throw new Error('Limite de créditos atingido');
  }

  await supabase.from('usage_logs').insert({
    user_id: userId,
    subscription_id: subscription.id,
    action_type: actionType,
    credits_consumed: 1,
    metadata: metadata,
  });

  if (subscription.plan?.credits_per_month !== null) {
    await supabase
      .from('subscriptions')
      .update({
        credits_used: (subscription.credits_used || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);
  }
}

export async function getUsageStats(userId: string, days: number = 30): Promise<{
  total: number;
  byType: Record<string, number>;
  logs: UsageLog[];
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', fromDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching usage stats:', error);
    throw error;
  }

  const logs = data || [];
  const total = logs.reduce((sum, log) => sum + log.credits_consumed, 0);
  const byType = logs.reduce((acc, log) => {
    acc[log.action_type] = (acc[log.action_type] || 0) + log.credits_consumed;
    return acc;
  }, {} as Record<string, number>);

  return { total, byType, logs };
}

export async function upgradeToPro(userId: string, paymentProviderId?: string): Promise<void> {
  const proPlan = await supabase
    .from('plans')
    .select('id')
    .eq('name', 'pro')
    .single();

  if (!proPlan.data) {
    throw new Error('Plano Pro não encontrado');
  }

  const currentSubscription = await getUserSubscription(userId);
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
    plan_id: proPlan.data.id,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    credits_used: 0,
    payment_provider_id: paymentProviderId || null,
  });
}

export async function cancelSubscription(userId: string): Promise<void> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    throw new Error('Nenhuma assinatura ativa encontrada');
  }

  if (subscription.plan?.name === 'free') {
    throw new Error('O plano Free não pode ser cancelado');
  }

  await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);
}
