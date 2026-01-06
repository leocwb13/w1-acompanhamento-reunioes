import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type ClientPortalAccess = Database['public']['Tables']['client_portal_access']['Row'];

export async function getPortalAccess(clientId: string): Promise<ClientPortalAccess | null> {
  try {
    const { data, error } = await supabase
      .from('client_portal_access')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching portal access:', error);
    throw error;
  }
}

export async function createPortalAccess(clientId: string): Promise<ClientPortalAccess> {
  try {
    const { data, error } = await supabase
      .from('client_portal_access')
      .insert({ client_id: clientId, enabled: true })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating portal access:', error);
    throw error;
  }
}

export async function updatePortalAccess(
  clientId: string,
  updates: { enabled?: boolean }
): Promise<ClientPortalAccess> {
  try {
    const { data, error } = await supabase
      .from('client_portal_access')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('client_id', clientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating portal access:', error);
    throw error;
  }
}

export async function regeneratePortalToken(clientId: string): Promise<ClientPortalAccess> {
  try {
    const newToken = crypto.randomUUID();

    const { data, error } = await supabase
      .from('client_portal_access')
      .update({
        access_token: newToken,
        updated_at: new Date().toISOString()
      })
      .eq('client_id', clientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error regenerating portal token:', error);
    throw error;
  }
}

export async function getClientByToken(token: string) {
  try {
    const { data: portalAccess, error: portalError } = await supabase
      .from('client_portal_access')
      .select('*, client:clients(*)')
      .eq('access_token', token)
      .eq('enabled', true)
      .maybeSingle();

    if (portalError) throw portalError;
    if (!portalAccess) return null;

    await supabase
      .from('client_portal_access')
      .update({ last_access_at: new Date().toISOString() })
      .eq('id', portalAccess.id);

    return portalAccess;
  } catch (error) {
    console.error('Error fetching client by token:', error);
    throw error;
  }
}

export async function getPortalData(clientId: string) {
  try {
    const [tasksResult, meetingsResult, clientResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),

      supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)
        .order('datetime', { ascending: false }),

      supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (meetingsResult.error) throw meetingsResult.error;
    if (clientResult.error) throw clientResult.error;

    return {
      client: clientResult.data,
      tasks: tasksResult.data,
      meetings: meetingsResult.data
    };
  } catch (error) {
    console.error('Error fetching portal data:', error);
    throw error;
  }
}
