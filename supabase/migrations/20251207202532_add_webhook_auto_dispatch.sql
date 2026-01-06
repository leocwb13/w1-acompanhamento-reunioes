/*
  # Enable Automatic Webhook Dispatch via Database Triggers

  ## Overview
  This migration enables automatic, near-instantaneous processing of webhook events
  using PostgreSQL triggers and the pg_net extension to call the webhook-dispatcher
  Edge Function whenever a new event is queued.

  ## Changes

  1. **Enable pg_net Extension**
     - Allows PostgreSQL to make asynchronous HTTP requests
     - Used to call the webhook-dispatcher Edge Function

  2. **Create webhook_dispatcher_config Table**
     - Stores internal secret key for authenticating trigger requests
     - Stores SUPABASE_URL for constructing Edge Function URL
     - Single-row configuration table

  3. **Create webhook_dispatcher_runs Table**
     - Tracks each execution of the dispatcher
     - Provides visibility into trigger performance
     - Helps debug issues and monitor health

  4. **Create trigger_webhook_dispatcher() Function**
     - PostgreSQL function that makes HTTP POST to Edge Function
     - Uses pg_net for async non-blocking requests
     - Includes debounce logic to prevent excessive calls
     - Handles errors gracefully without failing inserts

  5. **Create auto_dispatch_webhook_events Trigger**
     - Fires AFTER INSERT on webhook_events_queue
     - Only for events with status='pending'
     - Calls trigger_webhook_dispatcher() automatically

  ## Security
  - Internal secret key validates requests to Edge Function
  - Trigger runs with elevated privileges to call Edge Function
  - RLS enabled on all new tables
  - Only admins can modify dispatcher configuration

  ## Important Notes
  - pg_net extension must be enabled in Supabase Dashboard first
  - SUPABASE_URL must be configured in webhook_dispatcher_config
  - Internal secret must match in both database and Edge Function
  - HTTP requests are async and don't block insert operations
  - Debounce prevents multiple simultaneous calls (2 second minimum interval)
*/

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Table to store dispatcher configuration
CREATE TABLE IF NOT EXISTS webhook_dispatcher_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_url text NOT NULL,
  internal_secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled boolean DEFAULT true,
  debounce_seconds integer DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_config_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Create single configuration row with placeholder URL
-- IMPORTANT: Update this with your actual Supabase URL after deployment
INSERT INTO webhook_dispatcher_config (id, supabase_url)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'https://placeholder.supabase.co')
ON CONFLICT (id) DO NOTHING;

-- Table to track dispatcher executions for monitoring
CREATE TABLE IF NOT EXISTS webhook_dispatcher_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by text DEFAULT 'database_trigger',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  events_processed integer DEFAULT 0,
  success boolean,
  error_message text,
  request_id bigint,
  http_status integer
);

-- Enable RLS on new tables
ALTER TABLE webhook_dispatcher_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_dispatcher_runs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read configuration (for debugging)
CREATE POLICY "Authenticated users can read dispatcher config"
  ON webhook_dispatcher_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update configuration
CREATE POLICY "Only admins can update dispatcher config"
  ON webhook_dispatcher_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Authenticated users can read dispatcher runs
CREATE POLICY "Users can read dispatcher runs"
  ON webhook_dispatcher_runs
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to trigger webhook dispatcher via HTTP request
CREATE OR REPLACE FUNCTION trigger_webhook_dispatcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config webhook_dispatcher_config%ROWTYPE;
  v_last_run timestamptz;
  v_debounce_seconds integer;
  v_url text;
  v_request_id bigint;
  v_run_id uuid;
BEGIN
  -- Get dispatcher configuration
  SELECT * INTO v_config
  FROM webhook_dispatcher_config
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

  -- Exit if dispatcher is disabled
  IF NOT v_config.enabled THEN
    RETURN NEW;
  END IF;

  -- Implement debounce: check last run time
  v_debounce_seconds := COALESCE(v_config.debounce_seconds, 2);

  SELECT started_at INTO v_last_run
  FROM webhook_dispatcher_runs
  WHERE triggered_by = 'database_trigger'
  ORDER BY started_at DESC
  LIMIT 1;

  -- If last run was too recent, skip this trigger
  IF v_last_run IS NOT NULL AND
     v_last_run > (now() - (v_debounce_seconds || ' seconds')::interval) THEN
    RETURN NEW;
  END IF;

  -- Create run log entry
  INSERT INTO webhook_dispatcher_runs (triggered_by, started_at)
  VALUES ('database_trigger', now())
  RETURNING id INTO v_run_id;

  -- Construct Edge Function URL
  v_url := v_config.supabase_url || '/functions/v1/webhook-dispatcher';

  -- Make async HTTP POST request using pg_net
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', v_config.internal_secret
    ),
    body := jsonb_build_object(
      'triggered_by', 'database_trigger',
      'event_id', NEW.id,
      'timestamp', now()
    )
  ) INTO v_request_id;

  -- Update run log with request ID
  UPDATE webhook_dispatcher_runs
  SET request_id = v_request_id
  WHERE id = v_run_id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  INSERT INTO webhook_dispatcher_runs (
    triggered_by,
    started_at,
    completed_at,
    success,
    error_message
  ) VALUES (
    'database_trigger',
    now(),
    now(),
    false,
    SQLERRM
  );

  -- Return NEW to allow the insert to succeed
  RETURN NEW;
END;
$$;

-- Create trigger on webhook_events_queue
DROP TRIGGER IF EXISTS auto_dispatch_webhook_events ON webhook_events_queue;

CREATE TRIGGER auto_dispatch_webhook_events
  AFTER INSERT ON webhook_events_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_webhook_dispatcher();

-- Function to get dispatcher status (for UI monitoring)
CREATE OR REPLACE FUNCTION get_webhook_dispatcher_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config webhook_dispatcher_config%ROWTYPE;
  v_pending_count integer;
  v_last_run webhook_dispatcher_runs%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Get configuration
  SELECT * INTO v_config
  FROM webhook_dispatcher_config
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

  -- Count pending events
  SELECT COUNT(*) INTO v_pending_count
  FROM webhook_events_queue
  WHERE status = 'pending';

  -- Get last run
  SELECT * INTO v_last_run
  FROM webhook_dispatcher_runs
  ORDER BY started_at DESC
  LIMIT 1;

  -- Build result
  v_result := jsonb_build_object(
    'enabled', v_config.enabled,
    'pending_events', v_pending_count,
    'last_run_at', v_last_run.started_at,
    'last_run_success', v_last_run.success,
    'last_run_error', v_last_run.error_message,
    'debounce_seconds', v_config.debounce_seconds
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_webhook_dispatcher_status() TO authenticated;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_webhook_dispatcher_runs_started_at
  ON webhook_dispatcher_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_queue_status_created
  ON webhook_events_queue(status, created_at)
  WHERE status = 'pending';
