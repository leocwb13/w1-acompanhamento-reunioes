/*
  # Clean Up Orphaned Clients and Enforce User ID

  ## Overview
  This migration ensures proper user isolation by removing orphaned data and enforcing user_id constraints.

  ## Changes Made

  1. **Data Cleanup**
     - Delete all clients without user_id (orphaned clients)
     - Cascade delete associated meetings, tasks, decisions, email_drafts, conversation_history, and risk_events
     - Remove orphaned records from related tables

  2. **Schema Enforcement**
     - Make clients.user_id column NOT NULL to prevent future orphaned clients
     - Add database-level check to ensure user_id is always set on client creation

  3. **Admin Role Support**
     - Add is_admin column to user_profiles for admin functionality
     - Create admin-specific RLS policies for cross-user access
     - Maintain security for regular users while allowing admin override

  ## Security Notes
  - RLS policies remain restrictive for regular users
  - Only users with is_admin = true can view all clients
  - All data modifications still require ownership or admin status
*/

-- Step 1: Delete orphaned data in dependent tables first (to avoid foreign key violations)

-- Delete conversation history for clients without user_id
DELETE FROM conversation_history
WHERE client_id IN (
  SELECT id FROM clients WHERE user_id IS NULL
);

-- Delete email drafts for clients without user_id
DELETE FROM email_drafts
WHERE client_id IN (
  SELECT id FROM clients WHERE user_id IS NULL
);

-- Delete risk events for clients without user_id
DELETE FROM risk_events
WHERE client_id IN (
  SELECT id FROM clients WHERE user_id IS NULL
);

-- Delete decisions for meetings of clients without user_id
DELETE FROM decisions
WHERE meeting_id IN (
  SELECT m.id FROM meetings m
  INNER JOIN clients c ON m.client_id = c.id
  WHERE c.user_id IS NULL
);

-- Delete tasks for clients without user_id
DELETE FROM tasks
WHERE client_id IN (
  SELECT id FROM clients WHERE user_id IS NULL
);

-- Delete meetings for clients without user_id
DELETE FROM meetings
WHERE client_id IN (
  SELECT id FROM clients WHERE user_id IS NULL
);

-- Delete clients without user_id
DELETE FROM clients WHERE user_id IS NULL;

-- Step 2: Make user_id NOT NULL on clients table
ALTER TABLE clients ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Add is_admin column to user_profiles for admin functionality
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Step 4: Update RLS policies to support admin access while maintaining user isolation

-- Drop existing policies to recreate with admin support
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

-- Recreate policies with admin support
CREATE POLICY "Users can view own clients or admins can view all"
  ON clients FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients or admins can update all"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can delete own clients or admins can delete all"
  ON clients FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Step 5: Update policies for related tables to support admin access

-- Meetings policies with admin support
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;

CREATE POLICY "Users can view own meetings or admins can view all"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = meetings.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can insert own meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = meetings.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own meetings or admins can update all"
  ON meetings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = meetings.client_id
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
      WHERE clients.id = meetings.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can delete own meetings or admins can delete all"
  ON meetings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = meetings.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Tasks policies with admin support
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

CREATE POLICY "Users can view own tasks or admins can view all"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = tasks.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = tasks.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tasks or admins can update all"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = tasks.client_id
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
      WHERE clients.id = tasks.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Users can delete own tasks or admins can delete all"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = tasks.client_id
      AND clients.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Add index to optimize admin checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(id, is_admin) WHERE is_admin = true;

-- Add helpful comment
COMMENT ON COLUMN user_profiles.is_admin IS 'Allows admin users to view and manage all clients across all users for support and management purposes';
