import { supabase } from '../lib/supabase';
import type { Database, TaskOwner, TaskStatus } from '../lib/database.types';

type Task = Database['public']['Tables']['tasks']['Row'];

export interface CreateTaskData {
  client_id: string;
  meeting_id?: string;
  title: string;
  description?: string;
  owner: TaskOwner;
  due_date: string;
}

export async function createTasks(tasks: CreateTaskData[]): Promise<Task[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    tasks.forEach(task => {
      if (!task.title || task.title.trim() === '') {
        throw new Error('Task title is required');
      }
      if (!task.owner) {
        throw new Error('Task owner is required');
      }
      if (!task.due_date) {
        throw new Error('Task due_date is required');
      }
    });

    const clientIds = [...new Set(tasks.map(t => t.client_id))];
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .in('id', clientIds);

    if (clientError) throw clientError;
    if (!clients || clients.length !== clientIds.length) {
      throw new Error('One or more clients not found');
    }

    const unauthorizedClient = clients.find(c => c.user_id !== user.id);
    if (unauthorizedClient) {
      throw new Error('Unauthorized: One or more clients do not belong to user');
    }

    const { data, error} = await supabase
      .from('tasks')
      .insert(tasks)
      .select();

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in createTasks:', error);
    throw error;
  }
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  try {
    const updateData: any = { status };

    if (status === 'concluida') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateTaskStatus:', error);
    throw error;
  }
}

export async function getTasksByClient(clientId: string): Promise<Task[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) throw new Error('Client not found');
    if (client.user_id !== user.id) {
      throw new Error('Unauthorized: Client does not belong to user');
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getTasksByClient:', error);
    throw error;
  }
}

export async function getAllTasks(): Promise<Task[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        client:clients(*)
      `)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getAllTasks:', error);
    throw error;
  }
}
