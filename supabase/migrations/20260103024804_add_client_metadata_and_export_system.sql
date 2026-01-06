/*
  # Client Metadata and Export System for N8N Integration

  ## Overview
  This migration adds comprehensive metadata storage for clients and enhances
  the webhook system to support complete data export for N8N automations.

  ## 1. New Tables

  ### client_metadata
  Stores extended client information for complete profile and N8N integration:
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, foreign key) - Reference to clients table
  - `document_number` (text) - CPF/CNPJ
  - `birth_date` (date) - Date of birth
  - `address_street` (text) - Street address
  - `address_city` (text) - City
  - `address_state` (text) - State
  - `address_zip` (text) - ZIP/Postal code
  - `monthly_income` (numeric) - Monthly income
  - `estimated_patrimony` (numeric) - Estimated total patrimony
  - `financial_goals` (text) - Financial goals description
  - `contact_preference` (text) - Preferred contact method
  - `best_contact_time` (text) - Best time to contact
  - `tags` (text[]) - Custom tags for segmentation
  - `notes` (text) - Additional notes
  - `custom_fields` (jsonb) - Flexible custom data
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security
  - Enable RLS on client_metadata table
  - Users can only access metadata for their own clients
  - Admins can view all metadata

  ## 3. Indexes
  - Index on client_id for fast lookups
  - Index on tags for filtering

  ## 4. Additional Features
  - Automatic updated_at timestamp trigger
  - One-to-one relationship with clients table
*/

-- Create client_metadata table
CREATE TABLE IF NOT EXISTS client_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  document_number text,
  birth_date date,
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  monthly_income numeric(15, 2),
  estimated_patrimony numeric(15, 2),
  financial_goals text,
  contact_preference text,
  best_contact_time text,
  tags text[] DEFAULT ARRAY[]::text[],
  notes text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_metadata_client_id ON client_metadata(client_id);
CREATE INDEX IF NOT EXISTS idx_client_metadata_tags ON client_metadata USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE client_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_metadata
CREATE POLICY "Users can view metadata for own clients or admins can view all"
  ON client_metadata FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_metadata.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can insert metadata for own clients"
  ON client_metadata FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_metadata.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update metadata for own clients or admins can update all"
  ON client_metadata FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_metadata.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_metadata.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can delete metadata for own clients"
  ON client_metadata FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_metadata.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_client_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_metadata_updated_at ON client_metadata;
CREATE TRIGGER trigger_client_metadata_updated_at
  BEFORE UPDATE ON client_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_client_metadata_updated_at();