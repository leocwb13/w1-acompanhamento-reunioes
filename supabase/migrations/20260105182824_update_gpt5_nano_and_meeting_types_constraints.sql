/*
  # Update GPT Model Default and Add Meeting Types Constraints

  ## Changes

  1. **Update OpenAI Model Default**
     - Updates the default OpenAI model from 'gpt-4-turbo-preview' to 'gpt-5-nano'
     - Updates existing global settings that use the old default
     - Only affects settings where user_id is null (global settings)

  2. **Meeting Types Constraints**
     - Adds check constraint to limit custom meeting types to 10 per user
     - Ensures data integrity for the meeting types system
     - Does not affect system meeting types (where user_id is null)

  ## Notes
  - Existing user settings are NOT modified (users who explicitly set a model keep their preference)
  - The constraint allows unlimited system types (is_system = true)
  - Custom types are limited to 10 per user for performance and UX reasons
*/

-- ============================================
-- 1. UPDATE GPT MODEL DEFAULT
-- ============================================

-- Update global settings that still use old default
UPDATE settings
SET value = 'gpt-5-nano', updated_at = now()
WHERE key = 'openai_model'
  AND value = 'gpt-4-turbo-preview'
  AND user_id IS NULL;

-- Insert gpt-5-nano as default if no global setting exists
INSERT INTO settings (key, value, description, user_id, updated_at)
VALUES ('openai_model', 'gpt-5-nano', 'Modelo GPT a ser usado', NULL, now())
ON CONFLICT (key, user_id) WHERE user_id IS NULL
DO UPDATE SET value = 'gpt-5-nano', updated_at = now()
WHERE settings.value = 'gpt-4-turbo-preview';

-- ============================================
-- 2. ADD MEETING TYPES CONSTRAINTS
-- ============================================

-- Function to count custom meeting types per user
CREATE OR REPLACE FUNCTION check_custom_meeting_types_limit()
RETURNS TRIGGER AS $$
DECLARE
  custom_count INTEGER;
BEGIN
  -- Only check for non-system types
  IF NEW.is_system = false AND NEW.user_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO custom_count
    FROM meeting_types
    WHERE user_id = NEW.user_id
      AND is_system = false
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF custom_count >= 10 THEN
      RAISE EXCEPTION 'Limite de 10 tipos customizados atingido para este usuário';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS enforce_custom_meeting_types_limit ON meeting_types;

CREATE TRIGGER enforce_custom_meeting_types_limit
BEFORE INSERT OR UPDATE ON meeting_types
FOR EACH ROW
EXECUTE FUNCTION check_custom_meeting_types_limit();

-- Add index to improve performance of the constraint check
CREATE INDEX IF NOT EXISTS idx_meeting_types_user_custom ON meeting_types(user_id, is_system) WHERE is_system = false;

-- ============================================
-- 3. VALIDATION
-- ============================================

-- Verify system types exist
DO $$
DECLARE
  system_types_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO system_types_count
  FROM meeting_types
  WHERE is_system = true;

  IF system_types_count < 5 THEN
    RAISE WARNING 'Menos de 5 tipos de sistema encontrados. Verifique se os tipos do sistema foram criados corretamente.';
  END IF;
END $$;
