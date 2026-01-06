import { supabase } from '../lib/supabase';
import { getClient } from './clientService';
import { getMeetingsByClient } from './meetingService';
import { getTasksByClient } from './taskService';
import type { Database } from '../lib/database.types';

type ClientMetadata = Database['public']['Tables']['client_metadata']['Row'];
type RiskEvent = Database['public']['Tables']['risk_events']['Row'];
type EmailDraft = Database['public']['Tables']['email_drafts']['Row'];

export interface CompleteClientExport {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    revenue_bracket: string | null;
    status: string;
    risk_score: number;
    last_activity_date: string | null;
    created_at: string;
    updated_at: string;
  };
  metadata: ClientMetadata | null;
  meetings: Array<{
    id: string;
    type: string;
    datetime: string;
    summary: string | null;
    decisions: any;
    risk_signals: string | null;
    transcript_text: string | null;
    created_at: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    owner: string;
    status: string;
    due_date: string;
    completed_at: string | null;
    created_at: string;
  }>;
  risk_events: RiskEvent[];
  email_drafts: Array<{
    id: string;
    meeting_id: string | null;
    subject: string;
    html_body: string;
    created_at: string;
  }>;
  summary: {
    total_meetings: number;
    total_tasks: number;
    pending_tasks: number;
    completed_tasks: number;
    total_risk_events: number;
    days_since_last_activity: number | null;
  };
  export_metadata: {
    exported_at: string;
    exported_by: string;
    version: string;
  };
}

export async function exportCompleteClientData(clientId: string): Promise<CompleteClientExport> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const client = await getClient({ id: clientId });
    if (!client) {
      throw new Error('Client not found');
    }

    const { data: metadata } = await supabase
      .from('client_metadata')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    const meetings = await getMeetingsByClient(clientId);

    const tasks = await getTasksByClient(clientId);

    const { data: riskEvents } = await supabase
      .from('risk_events')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    const { data: emailDrafts } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    const pendingTasks = tasks.filter(t => t.status === 'pendente' || t.status === 'em_andamento');
    const completedTasks = tasks.filter(t => t.status === 'concluida');

    let daysSinceLastActivity: number | null = null;
    if (client.last_activity_date) {
      const lastActivity = new Date(client.last_activity_date);
      const today = new Date();
      daysSinceLastActivity = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        revenue_bracket: client.revenue_bracket,
        status: client.status,
        risk_score: client.risk_score,
        last_activity_date: client.last_activity_date,
        created_at: client.created_at,
        updated_at: client.updated_at,
      },
      metadata: metadata || null,
      meetings: meetings.map(m => ({
        id: m.id,
        type: m.type,
        datetime: m.datetime,
        summary: m.summary,
        decisions: m.decisions,
        risk_signals: m.risk_signals,
        transcript_text: m.transcript_text,
        created_at: m.created_at,
      })),
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        owner: t.owner,
        status: t.status,
        due_date: t.due_date,
        completed_at: t.completed_at,
        created_at: t.created_at,
      })),
      risk_events: riskEvents || [],
      email_drafts: (emailDrafts || []).map(e => ({
        id: e.id,
        meeting_id: e.meeting_id,
        subject: e.subject,
        html_body: e.html_body,
        created_at: e.created_at,
      })),
      summary: {
        total_meetings: meetings.length,
        total_tasks: tasks.length,
        pending_tasks: pendingTasks.length,
        completed_tasks: completedTasks.length,
        total_risk_events: riskEvents?.length || 0,
        days_since_last_activity: daysSinceLastActivity,
      },
      export_metadata: {
        exported_at: new Date().toISOString(),
        exported_by: user.id,
        version: '1.0.0',
      },
    };
  } catch (error) {
    console.error('Error in exportCompleteClientData:', error);
    throw error;
  }
}

export async function getClientMetadata(clientId: string): Promise<ClientMetadata | null> {
  try {
    const { data, error } = await supabase
      .from('client_metadata')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getClientMetadata:', error);
    throw error;
  }
}

export async function upsertClientMetadata(
  clientId: string,
  metadata: Partial<Omit<ClientMetadata, 'id' | 'client_id' | 'created_at' | 'updated_at'>>
): Promise<ClientMetadata> {
  try {
    const { data: existing } = await supabase
      .from('client_metadata')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('client_metadata')
        .update(metadata)
        .eq('client_id', clientId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('client_metadata')
        .insert({
          client_id: clientId,
          ...metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error in upsertClientMetadata:', error);
    throw error;
  }
}

export function downloadJSON(data: any, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(data: any): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);
  await navigator.clipboard.writeText(jsonString);
}
