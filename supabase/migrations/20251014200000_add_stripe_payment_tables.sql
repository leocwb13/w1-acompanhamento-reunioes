/*
  # Add Stripe Payment Integration Tables

  1. New Tables
    - `payment_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `subscription_id` (uuid, references subscriptions)
      - `stripe_payment_intent_id` (text, unique)
      - `stripe_invoice_id` (text)
      - `amount` (integer, in cents)
      - `currency` (text, default 'brl')
      - `status` (text, succeeded/pending/failed)
      - `payment_method_type` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `stripe_webhooks_log`
      - `id` (uuid, primary key)
      - `event_id` (text, unique)
      - `event_type` (text)
      - `payload` (jsonb)
      - `processed` (boolean, default false)
      - `processed_at` (timestamptz)
      - `error_message` (text)
      - `created_at` (timestamptz)

  2. Modifications
    - Add Stripe fields to `subscriptions` table
      - `stripe_customer_id` (text)
      - `stripe_subscription_id` (text)
      - `stripe_price_id` (text)
      - `cancel_at_period_end` (boolean, default false)

  3. Security
    - Enable RLS on new tables
    - Add policies for users to view their own transactions
    - Add policies for service role to manage all records
*/

-- Add Stripe fields to subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_price_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end boolean DEFAULT false;
  END IF;
END $$;

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_invoice_id text,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'brl',
  status text NOT NULL DEFAULT 'pending',
  payment_method_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stripe_webhooks_log table
CREATE TABLE IF NOT EXISTS stripe_webhooks_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_id ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_log_event_id ON stripe_webhooks_log(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_log_processed ON stripe_webhooks_log(processed);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhooks_log ENABLE ROW LEVEL SECURITY;

-- Policies for payment_transactions
CREATE POLICY "Users can view own transactions"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions"
  ON payment_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for stripe_webhooks_log
CREATE POLICY "Service role can manage webhook logs"
  ON stripe_webhooks_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at_trigger ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at_trigger
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_transactions_updated_at();
