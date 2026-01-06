import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { triggerWebhooks, WEBHOOK_EVENTS } from './webhookService';

type Client = Database['public']['Tables']['clients']['Row'];
type Meeting = Database['public']['Tables']['meetings']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];

export interface ClientWithMetrics extends Client {
  recent_meetings: Meeting[];
  pending_tasks: Task[];
  overdue_client_tasks: Task[];
  days_since_last_advance: number | null;
  completed_tasks_last_week: number;
}

export interface ListClientsFilters {
  risk_level?: 'low' | 'medium' | 'high';
  no_advance_days?: number;
  has_overdue_client_tasks?: boolean;
}

export async function getClient(params: { id?: string; name?: string }): Promise<ClientWithMetrics | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    let query = supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id);

    if (params.id) {
      query = query.eq('id', params.id);
    } else if (params.name) {
      query = query.ilike('name', `%${params.name}%`);
    } else {
      throw new Error('Either id or name must be provided');
    }

    const { data: client, error } = await query.maybeSingle();

    if (error) throw error;
    if (!client) return null;

    const { data: meetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('client_id', client.id)
      .order('datetime', { ascending: false })
      .limit(3);

    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['pendente', 'em_andamento'])
      .order('due_date', { ascending: true });

    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', client.id)
      .eq('owner', 'Cliente')
      .in('status', ['pendente', 'em_andamento'])
      .lt('due_date', new Date().toISOString().split('T')[0]);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { count: completedCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('status', 'concluida')
      .gte('completed_at', oneWeekAgo.toISOString());

    let daysSinceLastAdvance: number | null = null;
    if (client.last_activity_date) {
      const lastActivity = new Date(client.last_activity_date);
      const today = new Date();
      daysSinceLastAdvance = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      ...client,
      recent_meetings: meetings || [],
      pending_tasks: pendingTasks || [],
      overdue_client_tasks: overdueTasks || [],
      days_since_last_advance: daysSinceLastAdvance,
      completed_tasks_last_week: completedCount || 0
    };
  } catch (error) {
    console.error('Error in getClient:', error);
    throw error;
  }
}

export async function listClients(filters: ListClientsFilters = {}): Promise<Client[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    let query = supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id);

    if (filters.risk_level) {
      const ranges = {
        low: [0, 39],
        medium: [40, 69],
        high: [70, 100]
      };
      const [min, max] = ranges[filters.risk_level];
      query = query.gte('risk_score', min).lte('risk_score', max);
    }

    if (filters.no_advance_days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.no_advance_days);
      query = query.or(`last_activity_date.is.null,last_activity_date.lt.${cutoffDate.toISOString()}`);
    }

    const { data, error } = await query.order('risk_score', { ascending: false });

    if (error) throw error;

    let clients = data || [];

    if (filters.has_overdue_client_tasks) {
      const clientsWithOverdueTasks = await Promise.all(
        clients.map(async (client) => {
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client.id)
            .eq('owner', 'Cliente')
            .in('status', ['pendente', 'em_andamento'])
            .lt('due_date', new Date().toISOString().split('T')[0]);

          return count && count > 0 ? client : null;
        })
      );
      clients = clientsWithOverdueTasks.filter(c => c !== null) as Client[];
    }

    return clients;
  } catch (error) {
    console.error('Error in listClients:', error);
    throw error;
  }
}

export async function createClient(data: {
  name: string;
  email?: string;
  phone?: string;
  revenue_bracket?: string;
}): Promise<Client> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        revenue_bracket: data.revenue_bracket,
        user_id: user.id,
        status: 'prospecto'
      })
      .select()
      .single();

    if (error) throw error;

    await triggerWebhooks(WEBHOOK_EVENTS.CLIENT_CREATED, {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      status: client.status,
      risk_score: client.risk_score,
      revenue_bracket: client.revenue_bracket,
      created_at: client.created_at,
    });

    return client;
  } catch (error) {
    console.error('Error in createClient:', error);
    throw error;
  }
}

export async function updateClient(
  clientId: string,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    revenue_bracket?: string;
    risk_score?: number;
    last_activity_date?: string;
  }
): Promise<Client> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: previousClient } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: client, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    const previousValues = previousClient ? {
      name: previousClient.name,
      email: previousClient.email,
      phone: previousClient.phone,
      status: previousClient.status,
      risk_score: previousClient.risk_score,
      revenue_bracket: previousClient.revenue_bracket,
    } : undefined;

    await triggerWebhooks(
      WEBHOOK_EVENTS.CLIENT_UPDATED,
      {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        risk_score: client.risk_score,
        revenue_bracket: client.revenue_bracket,
        updated_at: client.updated_at,
      },
      previousValues
    );

    if (previousClient && previousClient.status !== client.status) {
      await triggerWebhooks(
        WEBHOOK_EVENTS.CLIENT_STATUS_CHANGED,
        {
          id: client.id,
          name: client.name,
          status: client.status,
          previous_status: previousClient.status,
          changed_at: new Date().toISOString(),
        }
      );
    }

    return client;
  } catch (error) {
    console.error('Error in updateClient:', error);
    throw error;
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('user_id', user.id);

    if (error) throw error;

    if (client) {
      await triggerWebhooks(WEBHOOK_EVENTS.CLIENT_DELETED, {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        risk_score: client.risk_score,
        revenue_bracket: client.revenue_bracket,
        deleted_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error in deleteClient:', error);
    throw error;
  }
}
