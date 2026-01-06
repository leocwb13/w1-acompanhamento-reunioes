import { supabase } from '../lib/supabase';

export interface WebhookConfig {
  id: string;
  user_id: string;
  name: string;
  url: string;
  secret_key: string;
  enabled: boolean;
  events: string[];
  headers: Record<string, string>;
  http_method: string;
  created_at: string;
  updated_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_config_id: string;
  event_type: string;
  event_id: string;
  payload: unknown;
  status_code: number | null;
  response_body: string | null;
  response_headers: Record<string, string> | null;
  attempt_number: number;
  error_message: string | null;
  duration_ms: number | null;
  success: boolean;
  created_at: string;
}

export interface WebhookEventQueue {
  id: string;
  webhook_config_id: string;
  event_type: string;
  event_id: string;
  payload: unknown;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  processed_at: string | null;
}

export interface WebhookEvent {
  event_type: string;
  data: unknown;
  previous_values?: unknown;
}

export const WEBHOOK_EVENTS = {
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_DELETED: 'client.deleted',
  CLIENT_STATUS_CHANGED: 'client.status_changed',
  CLIENT_METADATA_UPDATED: 'client.metadata_updated',
  MEETING_CREATED: 'meeting.created',
  MEETING_SUMMARY_GENERATED: 'meeting.summary_generated',
  EMAIL_GENERATED: 'email.generated',
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];

// Generate a random secret key for HMAC signing
export function generateSecretKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Create HMAC-SHA256 signature for webhook payload
export async function createWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Get all webhook configurations for current user
export async function getWebhookConfigs(): Promise<WebhookConfig[]> {
  const { data, error } = await supabase
    .from('webhook_configurations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get a single webhook configuration
export async function getWebhookConfig(id: string): Promise<WebhookConfig | null> {
  const { data, error } = await supabase
    .from('webhook_configurations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Create a new webhook configuration
export async function createWebhookConfig(config: {
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  http_method?: string;
  secret_key?: string;
}): Promise<WebhookConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const secretKey = config.secret_key || generateSecretKey();

  const { data, error } = await supabase
    .from('webhook_configurations')
    .insert({
      user_id: user.id,
      name: config.name,
      url: config.url,
      secret_key: secretKey,
      events: config.events,
      headers: config.headers || {},
      http_method: config.http_method || 'POST',
      enabled: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update a webhook configuration
export async function updateWebhookConfig(
  id: string,
  updates: {
    name?: string;
    url?: string;
    events?: string[];
    headers?: Record<string, string>;
    http_method?: string;
    enabled?: boolean;
  }
): Promise<WebhookConfig> {
  const { data, error } = await supabase
    .from('webhook_configurations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a webhook configuration
export async function deleteWebhookConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from('webhook_configurations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Regenerate secret key for a webhook
export async function regenerateSecretKey(id: string): Promise<string> {
  const newSecret = generateSecretKey();

  const { error } = await supabase
    .from('webhook_configurations')
    .update({ secret_key: newSecret })
    .eq('id', id);

  if (error) throw error;
  return newSecret;
}

// Get delivery logs for a webhook
export async function getWebhookLogs(
  webhookConfigId: string,
  limit: number = 100
): Promise<WebhookDeliveryLog[]> {
  const { data, error } = await supabase
    .from('webhook_delivery_logs')
    .select('*')
    .eq('webhook_config_id', webhookConfigId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Get recent delivery logs for all webhooks of current user
export async function getAllWebhookLogs(limit: number = 100): Promise<WebhookDeliveryLog[]> {
  const configs = await getWebhookConfigs();
  const configIds = configs.map(c => c.id);

  if (configIds.length === 0) return [];

  const { data, error } = await supabase
    .from('webhook_delivery_logs')
    .select('*')
    .in('webhook_config_id', configIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Queue a webhook event for delivery
export async function queueWebhookEvent(
  webhookConfigId: string,
  eventType: string,
  eventId: string,
  payload: unknown
): Promise<void> {
  const { error } = await supabase
    .from('webhook_events_queue')
    .insert({
      webhook_config_id: webhookConfigId,
      event_type: eventType,
      event_id: eventId,
      payload,
      status: 'pending',
      scheduled_for: new Date().toISOString(),
    });

  if (error) throw error;
}

// Trigger webhooks for a specific event
export async function triggerWebhooks(
  eventType: WebhookEventType,
  data: unknown,
  previousValues?: unknown
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all enabled webhooks for this user that listen to this event
    const { data: webhooks } = await supabase
      .from('webhook_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .contains('events', [eventType]);

    if (!webhooks || webhooks.length === 0) return;

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Build the payload
    const payload = {
      event_id: eventId,
      event_type: eventType,
      timestamp,
      test: false,
      data,
      ...(previousValues ? { previous_values: previousValues } : {}),
    };

    // Queue the event for each webhook
    for (const webhook of webhooks) {
      await queueWebhookEvent(webhook.id, eventType, eventId, payload);
    }

    // Note: The actual delivery is handled by the webhook-dispatcher edge function
    // which processes the queue asynchronously
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    // Don't throw - webhook failures shouldn't break the main operation
  }
}

// Send a test webhook
export async function sendTestWebhook(webhookConfigId: string): Promise<{
  success: boolean;
  statusCode?: number;
  error?: string;
  duration?: string;
  body?: any;
  errorType?: string;
}> {
  const webhook = await getWebhookConfig(webhookConfigId);
  if (!webhook) throw new Error('Webhook not found');

  const eventId = `evt_test_${Date.now()}`;
  const timestamp = new Date().toISOString();

  const payload = {
    event_id: eventId,
    event_type: 'test.webhook',
    timestamp,
    test: true,
    data: {
      message: 'This is a test webhook from your application',
      webhook_name: webhook.name,
      webhook_id: webhookConfigId,
    },
  };

  // Use the webhook-test edge function to avoid CORS issues
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-test`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhook.url,
        secret: webhook.secret_key,
        payload,
        customHeaders: webhook.headers || {},
        httpMethod: webhook.http_method || 'POST',
      }),
    });

    const result = await response.json();

    // Parse the duration to get numeric value for logging
    const durationMs = result.responseTime ? parseInt(result.responseTime) : 0;

    // Log the test delivery
    await supabase.from('webhook_delivery_logs').insert({
      webhook_config_id: webhookConfigId,
      event_type: 'test.webhook',
      event_id: eventId,
      payload,
      status_code: result.status || null,
      response_body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body),
      response_headers: result.headers || null,
      error_message: result.error || null,
      attempt_number: 1,
      success: result.success,
      duration_ms: durationMs,
    });

    return {
      success: result.success,
      statusCode: result.status,
      error: result.error,
      duration: result.responseTime,
      body: result.body,
      errorType: result.errorType,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log the failed test
    await supabase.from('webhook_delivery_logs').insert({
      webhook_config_id: webhookConfigId,
      event_type: 'test.webhook',
      event_id: eventId,
      payload,
      status_code: null,
      error_message: errorMessage,
      attempt_number: 1,
      success: false,
      duration_ms: 0,
    });

    return {
      success: false,
      error: errorMessage,
      errorType: 'fetch_error',
    };
  }
}

// Get webhook statistics
export async function getWebhookStats(webhookConfigId: string): Promise<{
  totalDeliveries: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDuration: number;
}> {
  const { data: logs } = await supabase
    .from('webhook_delivery_logs')
    .select('success, duration_ms')
    .eq('webhook_config_id', webhookConfigId);

  if (!logs || logs.length === 0) {
    return {
      totalDeliveries: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageDuration: 0,
    };
  }

  const successCount = logs.filter(l => l.success).length;
  const failureCount = logs.length - successCount;
  const totalDuration = logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0);
  const averageDuration = Math.round(totalDuration / logs.length);

  return {
    totalDeliveries: logs.length,
    successCount,
    failureCount,
    successRate: (successCount / logs.length) * 100,
    averageDuration,
  };
}

// Get pending events queue for a webhook
export async function getWebhookQueue(webhookConfigId: string, limit: number = 50): Promise<WebhookEventQueue[]> {
  const { data, error } = await supabase
    .from('webhook_events_queue')
    .select('*')
    .eq('webhook_config_id', webhookConfigId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Get all pending events for current user
export async function getAllWebhookQueue(limit: number = 100): Promise<WebhookEventQueue[]> {
  const configs = await getWebhookConfigs();
  const configIds = configs.map(c => c.id);

  if (configIds.length === 0) return [];

  const { data, error } = await supabase
    .from('webhook_events_queue')
    .select('*')
    .in('webhook_config_id', configIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export interface WebhookDispatcherStatus {
  enabled: boolean;
  pending_events: number;
  last_run_at: string | null;
  last_run_success: boolean | null;
  last_run_error: string | null;
  debounce_seconds: number;
}

export async function getDispatcherStatus(): Promise<WebhookDispatcherStatus | null> {
  try {
    const { data, error } = await supabase.rpc('get_webhook_dispatcher_status');

    if (error) {
      console.error('Error fetching dispatcher status:', error);
      return null;
    }

    return data as WebhookDispatcherStatus;
  } catch (error) {
    console.error('Error fetching dispatcher status:', error);
    return null;
  }
}

export async function forceProcessWebhooks(): Promise<{ success: boolean; message: string }> {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-dispatcher`;

    const { data: config } = await supabase
      .from('webhook_dispatcher_config')
      .select('internal_secret')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    if (!config) {
      throw new Error('Dispatcher configuration not found');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': config.internal_secret,
      },
      body: JSON.stringify({
        triggered_by: 'manual',
        timestamp: new Date().toISOString(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to process webhooks');
    }

    return {
      success: true,
      message: result.message || 'Webhooks processed successfully',
    };
  } catch (error) {
    console.error('Error forcing webhook processing:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
