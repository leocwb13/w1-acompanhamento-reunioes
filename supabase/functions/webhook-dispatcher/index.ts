import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Internal-Secret",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createHmacSignature(payload: string, secret: string): Promise<string> {
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

async function validateInternalSecret(providedSecret: string | null): Promise<boolean> {
  if (!providedSecret) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('webhook_dispatcher_config')
      .select('internal_secret')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    if (error || !data) {
      console.error('Failed to fetch internal secret:', error);
      return false;
    }

    return data.internal_secret === providedSecret;
  } catch (error) {
    console.error('Error validating internal secret:', error);
    return false;
  }
}

async function processWebhookEvent(event: any) {
  try {
    const { data: webhook, error: webhookError } = await supabase
      .from('webhook_configurations')
      .select('*')
      .eq('id', event.webhook_config_id)
      .eq('enabled', true)
      .maybeSingle();

    if (webhookError || !webhook) {
      console.error('Webhook config not found or disabled:', event.webhook_config_id);
      await supabase
        .from('webhook_events_queue')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', event.id);
      return;
    }

    if (webhook.failure_count >= 10) {
      console.log('Webhook has too many failures, skipping:', webhook.id);
      await supabase
        .from('webhook_events_queue')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', event.id);
      return;
    }

    const payloadString = JSON.stringify(event.payload);
    const signature = await createHmacSignature(payloadString, webhook.secret_key);

    // Build headers - start with just Content-Type and custom headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ClientHub-Webhooks/1.0',
      'X-Event-Type': event.event_type,
      'X-Delivery-ID': event.event_id,
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
      ...webhook.headers,
    };

    const startTime = Date.now();
    let success = false;
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let responseHeaders: Record<string, string> | null = null;
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const method = webhook.http_method || 'POST';
      const fetchOptions: RequestInit = {
        method: method,
        headers,
        signal: controller.signal,
      };

      // Add body for methods that support it
      if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
        fetchOptions.body = payloadString;
      }

      // Detailed logging for debugging
      console.log('🚀 Sending webhook:', {
        url: webhook.url,
        method: method,
        payloadPreview: payloadString.substring(0, 500),
        payloadLength: payloadString.length,
        headersCount: Object.keys(headers).length,
        eventType: event.event_type,
        eventId: event.event_id,
      });

      const response = await fetch(webhook.url, fetchOptions);

      clearTimeout(timeoutId);

      statusCode = response.status;
      success = statusCode >= 200 && statusCode < 300;
      responseBody = (await response.text()).substring(0, 10000);
      responseHeaders = Object.fromEntries(response.headers.entries());

      // Log response details
      console.log('✅ Webhook response:', {
        statusCode,
        success,
        responseBodyPreview: responseBody?.substring(0, 200),
        responseBodyLength: responseBody?.length || 0,
        duration: Date.now() - startTime,
      });

      if (success) {
        await supabase
          .from('webhook_configurations')
          .update({
            failure_count: 0,
            last_triggered_at: new Date().toISOString(),
          })
          .eq('id', webhook.id);

        await supabase
          .from('webhook_events_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', event.id);
      } else {
        await handleWebhookFailure(event, webhook);
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Webhook delivery failed:', {
        error: errorMessage,
        url: webhook.url,
        method: webhook.http_method || 'POST',
        eventType: event.event_type,
      });
      await handleWebhookFailure(event, webhook);
    }

    const duration = Date.now() - startTime;

    await supabase.from('webhook_delivery_logs').insert({
      webhook_config_id: webhook.id,
      event_type: event.event_type,
      event_id: event.event_id,
      payload: event.payload,
      status_code: statusCode,
      response_body: responseBody,
      response_headers: responseHeaders,
      attempt_number: event.attempts + 1,
      error_message: errorMessage,
      duration_ms: duration,
      success,
    });
  } catch (error) {
    console.error('Error processing webhook event:', error);
  }
}

async function handleWebhookFailure(event: any, webhook: any) {
  const newAttempts = event.attempts + 1;
  
  if (newAttempts >= event.max_attempts) {
    await supabase
      .from('webhook_events_queue')
      .update({
        status: 'failed',
        attempts: newAttempts,
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    await supabase
      .from('webhook_configurations')
      .update({
        failure_count: webhook.failure_count + 1,
      })
      .eq('id', webhook.id);
  } else {
    const backoffDelays = [60, 300, 1800, 7200, 43200];
    const delaySeconds = backoffDelays[newAttempts - 1] || 43200;
    const nextAttempt = new Date(Date.now() + delaySeconds * 1000);

    await supabase
      .from('webhook_events_queue')
      .update({
        attempts: newAttempts,
        scheduled_for: nextAttempt.toISOString(),
        status: 'pending',
      })
      .eq('id', event.id);

    await supabase
      .from('webhook_configurations')
      .update({
        failure_count: webhook.failure_count + 1,
      })
      .eq('id', webhook.id);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const internalSecret = req.headers.get('X-Internal-Secret');
    const isInternalCall = await validateInternalSecret(internalSecret);

    if (!isInternalCall) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing internal secret' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: pendingEvents, error } = await supabase
      .from('webhook_events_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);

    if (error) {
      console.error('Error fetching pending events:', error);
      throw error;
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending webhook events', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('webhook_events_queue')
      .update({ status: 'processing' })
      .in('id', pendingEvents.map(e => e.id));

    const processingPromises = pendingEvents.map(event => processWebhookEvent(event));
    await Promise.allSettled(processingPromises);

    return new Response(
      JSON.stringify({
        message: 'Webhook events processed',
        processed: pendingEvents.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in webhook dispatcher:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
