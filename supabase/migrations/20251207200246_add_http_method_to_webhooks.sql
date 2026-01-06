/*
  # Add HTTP Method Support to Webhooks
  
  ## Overview
  This migration adds HTTP method customization to webhook configurations,
  allowing users to specify whether their webhook endpoint expects GET, POST, 
  PUT, PATCH, DELETE, or other HTTP methods.
  
  ## Changes
  
  1. New Column
    - `http_method` (text) - HTTP method to use for webhook requests
      - Default: 'POST'
      - Allowed values: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
  
  2. Validation
    - Add constraint to ensure only valid HTTP methods are used
  
  ## Notes
  - Existing webhooks will default to POST method
  - The method can be changed via the webhook configuration UI
*/

-- Add http_method column to webhook_configurations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_configurations' AND column_name = 'http_method'
  ) THEN
    ALTER TABLE webhook_configurations 
    ADD COLUMN http_method text DEFAULT 'POST' NOT NULL;
  END IF;
END $$;

-- Add constraint to validate HTTP methods
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'webhook_http_method_valid'
  ) THEN
    ALTER TABLE webhook_configurations
    ADD CONSTRAINT webhook_http_method_valid 
    CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'));
  END IF;
END $$;