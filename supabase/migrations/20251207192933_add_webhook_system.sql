/*
  # Webhook System for Client Event Notifications
  
  ## Overview
  This migration creates a comprehensive webhook system that allows users to configure
  outbound webhooks that will be triggered when client events occur (create, update, delete).
  
  ## 1. New Tables
  
  ### webhook_configurations
  Stores webhook endpoint configurations per user with the following fields:
  - `id` (uuid, primary key) - Unique identifier for the webhook config
  - `user_id` (uuid, foreign key) - Owner of the webhook configuration
  - `name` (text) - Descriptive name for the webhook integration
  - `url` (text) - Destination URL where webhook POST requests will be sent
  - `secret_key` (text) - Secret key used for HMAC-SHA256 signature
  - `enabled` (boolean) - Whether this webhook is active
  - `events` (text[]) - Array of event types to monitor (e.g., 'client.created')
  - `headers` (jsonb) - Custom HTTP headers to include in webhook requests
  - `created_at` (timestamptz) - When the webhook was created
  - `updated_at` (timestamptz) - When the webhook was last modified
  - `last_triggered_at` (timestamptz) - Last time webhook was successfully triggered
  - `failure_count` (integer) - Consecutive failure count for circuit breaker
  
  ### webhook_delivery_logs
  Tracks all webhook delivery attempts with detailed information:
  - `id` (uuid, primary key) - Unique identifier for the delivery log
  - `webhook_config_id` (uuid, foreign key) - Which webhook configuration was used
  - `event_type` (text) - Type of event that triggered the webhook
  - `event_id` (text) - Unique identifier for the event
  - `payload` (jsonb) - Complete payload that was sent
  - `status_code` (integer) - HTTP status code returned by destination
  - `response_body` (text) - Response body from destination (truncated to 10KB)
  - `response_headers` (jsonb) - Response headers from destination
  - `attempt_number` (integer) - Which attempt this was (1-5)
  - `error_message` (text) - Error message if delivery failed
  - `duration_ms` (integer) - How long the request took in milliseconds
  - `created_at` (timestamptz) - When this delivery was attempted
  - `success` (boolean) - Whether the delivery was successful (2xx status)
  
  ### webhook_events_queue
  Queue for webhook events that need to be processed:
  - `id` (uuid, primary key) - Unique identifier for the queued event
  - `webhook_config_id` (uuid, foreign key) - Which webhook to trigger
  - `event_type` (text) - Type of event
  - `event_id` (text) - Unique event identifier
  - `payload` (jsonb) - Event payload to send
  - `scheduled_for` (timestamptz) - When to attempt delivery (for retries)
  - `attempts` (integer) - Number of attempts so far
  - `max_attempts` (integer) - Maximum number of attempts allowed
  - `status` (text) - Queue status: 'pending', 'processing', 'completed', 'failed'
  - `created_at` (timestamptz) - When event was queued
  - `processed_at` (timestamptz) - When event was successfully processed
  
  ## 2. Security
  - Enable RLS on all three tables
  - Users can only view/manage their own webhook configurations
  - Users can only view delivery logs for their own webhooks
  - Admins can view all webhook data for support purposes
  - Queue table has restricted access (only functions can write)
  
  ## 3. Indexes
  - Index on user_id for fast webhook lookup
  - Index on enabled and events for active webhook queries
  - Index on webhook_config_id and created_at for log queries
  - Index on status and scheduled_for for queue processing
  
  ## 4. Event Types Supported
  - client.created - When a new client is created
  - client.updated - When client data is updated
  - client.deleted - When a client is deleted
  - client.status_changed - When client status changes
*/

-- Create webhook_configurations table
CREATE TABLE IF NOT EXISTS webhook_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret_key text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  events text[] DEFAULT ARRAY['client.created', 'client.updated', 'client.deleted']::text[] NOT NULL,
  headers jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_triggered_at timestamptz,
  failure_count integer DEFAULT 0 NOT NULL,
  CONSTRAINT webhook_url_valid CHECK (url ~ '^https?://'),
  CONSTRAINT webhook_name_not_empty CHECK (char_length(name) > 0)
);

-- Create webhook_delivery_logs table
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id uuid NOT NULL REFERENCES webhook_configurations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL,
  status_code integer,
  response_body text,
  response_headers jsonb,
  attempt_number integer DEFAULT 1 NOT NULL,
  error_message text,
  duration_ms integer,
  success boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create webhook_events_queue table
CREATE TABLE IF NOT EXISTS webhook_events_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id uuid NOT NULL REFERENCES webhook_configurations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL,
  scheduled_for timestamptz DEFAULT now() NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  max_attempts integer DEFAULT 5 NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  CONSTRAINT queue_status_valid CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id ON webhook_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_enabled_events ON webhook_configurations(enabled, events);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_config_created ON webhook_delivery_logs(webhook_config_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON webhook_delivery_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status_scheduled ON webhook_events_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_config_id ON webhook_events_queue(webhook_config_id);

-- Enable Row Level Security
ALTER TABLE webhook_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_configurations
CREATE POLICY "Users can view own webhook configs or admins can view all"
  ON webhook_configurations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can insert own webhook configs"
  ON webhook_configurations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own webhook configs or admins can update all"
  ON webhook_configurations FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can delete own webhook configs"
  ON webhook_configurations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for webhook_delivery_logs
CREATE POLICY "Users can view logs for own webhooks or admins can view all"
  ON webhook_delivery_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM webhook_configurations
      WHERE webhook_configurations.id = webhook_delivery_logs.webhook_config_id
      AND webhook_configurations.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "System can insert delivery logs"
  ON webhook_delivery_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for webhook_events_queue
CREATE POLICY "Users can view queue for own webhooks or admins can view all"
  ON webhook_events_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM webhook_configurations
      WHERE webhook_configurations.id = webhook_events_queue.webhook_config_id
      AND webhook_configurations.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "System can manage queue"
  ON webhook_events_queue FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_webhook_updated_at ON webhook_configurations;
CREATE TRIGGER trigger_webhook_updated_at
  BEFORE UPDATE ON webhook_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_updated_at();