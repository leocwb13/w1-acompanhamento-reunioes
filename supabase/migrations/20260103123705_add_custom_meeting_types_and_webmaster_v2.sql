/*
  # Sistema de Tipos de Reuniões Customizáveis, Webmaster e Correção de Planos

  ## 1. Tipos de Reuniões Customizáveis
  - Nova tabela meeting_types com códigos customizáveis
  - Tipos do sistema: C1, C2, C3, C4, FUP

  ## 2. Sistema de Role Webmaster
  - Adicionar campo role em user_profiles
  - Setar leonardograciano20@gmail.com como webmaster
  - Criar logs de auditoria

  ## 3. Correção de Planos
  - Fremium: R$ 0,00 - 5 créditos
  - Standard: R$ 74,95 - 10 créditos
  - Premium: R$ 99,95 - 15 créditos
  - Infinity: R$ 174,95 - 30 créditos
  - Private: R$ 324,95 - Créditos ilimitados

  ## 4. Sistema de Reset de Créditos
  - Adicionar credits_reset_at em subscriptions
  - Função automática de reset mensal

  ## 5. Security
  - RLS em todas as tabelas
  - Webmaster tem acesso total
*/

-- ============================================
-- 1. CRIAR TABELA DE TIPOS DE REUNIÕES
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'Calendar',
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  order_position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_code UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_meeting_types_user_id ON meeting_types(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_types_code ON meeting_types(code);

ALTER TABLE meeting_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system types and own types"
  ON meeting_types FOR SELECT
  TO authenticated
  USING (is_system = true OR user_id = auth.uid());

CREATE POLICY "Users can create own meeting types"
  ON meeting_types FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_system = false);

CREATE POLICY "Users can update own meeting types"
  ON meeting_types FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_system = false)
  WITH CHECK (user_id = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own meeting types"
  ON meeting_types FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND is_system = false);

INSERT INTO meeting_types (user_id, code, display_name, description, color, icon, is_system, order_position)
VALUES
  (NULL, 'C1', 'C1 Análise', 'Mapear situação atual, dores e objetivos do cliente', '#3B82F6', 'Search', true, 1),
  (NULL, 'C2', 'C2 Proteção', 'Avaliar coberturas de seguro e riscos patrimoniais', '#10B981', 'Shield', true, 2),
  (NULL, 'C3', 'C3 Investimentos', 'Definir estratégia de alocação e liquidez', '#F59E0B', 'TrendingUp', true, 3),
  (NULL, 'C4', 'C4 Consolidação', 'Revisar todo o planejamento e criar roadmap', '#8B5CF6', 'CheckCircle', true, 4),
  (NULL, 'FUP', 'Follow-up', 'Verificar progresso e criar micro-entregáveis', '#EC4899', 'RefreshCw', true, 5)
ON CONFLICT (user_id, code) DO NOTHING;

-- ============================================
-- 2. ADICIONAR SISTEMA DE ROLE WEBMASTER
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role text DEFAULT 'user';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
      CHECK (role IN ('user', 'admin', 'webmaster'));
  END IF;
END $$;

UPDATE user_profiles
SET role = 'webmaster'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'leonardograciano20@gmail.com'
  LIMIT 1
);

CREATE TABLE IF NOT EXISTS webmaster_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webmaster_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id),
  target_resource text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webmaster_audit_logs_webmaster_id ON webmaster_audit_logs(webmaster_id);
CREATE INDEX IF NOT EXISTS idx_webmaster_audit_logs_created_at ON webmaster_audit_logs(created_at);

ALTER TABLE webmaster_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only webmasters can view audit logs"
  ON webmaster_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'webmaster'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON webmaster_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 3. ATUALIZAR PLANOS COM VALORES CORRETOS
-- ============================================

UPDATE plans SET
  name = 'fremium',
  display_name = 'Fremium',
  description = '5 Créditos Grátis para testar a plataforma',
  price_monthly = 0,
  credits_per_month = 5,
  features = '["5 créditos grátis", "Clientes ilimitados", "Resumos de reuniões", "Suporte por email"]'::jsonb
WHERE name = 'free';

INSERT INTO plans (name, display_name, description, price_monthly, currency, credits_per_month, features, is_active)
VALUES
  ('standard', 'Standard', 'Plano básico para começar', 7495, 'BRL', 10,
   '["10 créditos/mês", "Clientes ilimitados", "Resumos de reuniões", "Kanban", "Suporte por email"]'::jsonb, true),

  ('premium', 'Premium', 'Plano completo para profissionais', 9995, 'BRL', 15,
   '["15 créditos/mês", "Clientes ilimitados", "Portal do cliente", "Resumos avançados", "Kanban", "Suporte prioritário"]'::jsonb, true),

  ('infinity', 'Infinity', 'Plano avançado com mais recursos', 17495, 'BRL', 30,
   '["30 créditos/mês", "Clientes ilimitados", "Portal completo", "WhatsApp", "Webhooks", "Kanban", "Suporte prioritário"]'::jsonb, true),

  ('private', 'Private', 'Solução enterprise completa', 32495, 'BRL', NULL,
   '["Créditos ilimitados", "Clientes ilimitados", "Todos os recursos", "Branding customizado", "API completa", "Suporte dedicado 24/7"]'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  credits_per_month = EXCLUDED.credits_per_month,
  features = EXCLUDED.features;

UPDATE plans SET
  display_name = 'Pro',
  description = 'Plano profissional completo',
  price_monthly = 9995,
  credits_per_month = 15
WHERE name = 'pro';

-- ============================================
-- 4. ATUALIZAR PLAN_LIMITS
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_limits' AND column_name = 'max_clients'
  ) THEN
    ALTER TABLE plan_limits DROP COLUMN max_clients;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_limits' AND column_name = 'max_meetings_per_month'
  ) THEN
    ALTER TABLE plan_limits DROP COLUMN max_meetings_per_month;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_limits' AND column_name = 'api_access_enabled'
  ) THEN
    ALTER TABLE plan_limits ADD COLUMN api_access_enabled boolean DEFAULT false;
  END IF;
END $$;

INSERT INTO plan_limits (plan_id, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding, api_access_enabled)
SELECT id, false, false, false, true, false, false FROM plans WHERE name = 'fremium'
ON CONFLICT (plan_id) DO UPDATE SET
  portal_enabled = false,
  whatsapp_enabled = false,
  webhooks_enabled = false,
  kanban_enabled = true,
  custom_branding = false,
  api_access_enabled = false;

INSERT INTO plan_limits (plan_id, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding, api_access_enabled)
SELECT id, false, false, false, true, false, false FROM plans WHERE name = 'standard'
ON CONFLICT (plan_id) DO UPDATE SET
  portal_enabled = false,
  whatsapp_enabled = false,
  webhooks_enabled = false,
  kanban_enabled = true,
  custom_branding = false,
  api_access_enabled = false;

INSERT INTO plan_limits (plan_id, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding, api_access_enabled)
SELECT id, true, false, false, true, false, false FROM plans WHERE name IN ('premium', 'pro')
ON CONFLICT (plan_id) DO UPDATE SET
  portal_enabled = true,
  whatsapp_enabled = false,
  webhooks_enabled = false,
  kanban_enabled = true,
  custom_branding = false,
  api_access_enabled = false;

INSERT INTO plan_limits (plan_id, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding, api_access_enabled)
SELECT id, true, true, true, true, false, false FROM plans WHERE name = 'infinity'
ON CONFLICT (plan_id) DO UPDATE SET
  portal_enabled = true,
  whatsapp_enabled = true,
  webhooks_enabled = true,
  kanban_enabled = true,
  custom_branding = false,
  api_access_enabled = false;

INSERT INTO plan_limits (plan_id, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding, api_access_enabled)
SELECT id, true, true, true, true, true, true FROM plans WHERE name = 'private'
ON CONFLICT (plan_id) DO UPDATE SET
  portal_enabled = true,
  whatsapp_enabled = true,
  webhooks_enabled = true,
  kanban_enabled = true,
  custom_branding = true,
  api_access_enabled = true;

-- ============================================
-- 5. SISTEMA DE RESET DE CRÉDITOS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'credits_reset_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN credits_reset_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end boolean DEFAULT false;
  END IF;

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
END $$;

UPDATE subscriptions
SET credits_reset_at = current_period_end
WHERE credits_reset_at IS NULL;

CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  UPDATE subscriptions
  SET
    credits_used = 0,
    current_period_start = current_period_end,
    current_period_end = current_period_end + interval '30 days',
    credits_reset_at = current_period_end + interval '30 days',
    updated_at = now()
  WHERE
    status = 'active'
    AND current_period_end <= now()
    AND cancel_at_period_end = false;

  UPDATE subscriptions
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE
    status = 'active'
    AND current_period_end <= now()
    AND cancel_at_period_end = true;

  INSERT INTO usage_logs (user_id, subscription_id, action_type, credits_consumed, metadata)
  SELECT
    user_id,
    id,
    'credits_reset',
    0,
    jsonb_build_object('reset_date', now(), 'automatic', true)
  FROM subscriptions
  WHERE status = 'active' AND credits_reset_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. ATUALIZAR FUNÇÃO DE VERIFICAÇÃO
-- ============================================

CREATE OR REPLACE FUNCTION check_user_plan_limit(
  p_user_id uuid,
  p_limit_type text
) RETURNS boolean AS $$
DECLARE
  v_feature_enabled boolean;
  v_is_webmaster boolean;
BEGIN
  SELECT role = 'webmaster' INTO v_is_webmaster
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_webmaster THEN
    RETURN true;
  END IF;

  SELECT
    CASE
      WHEN p_limit_type = 'portal' THEN pl.portal_enabled
      WHEN p_limit_type = 'whatsapp' THEN pl.whatsapp_enabled
      WHEN p_limit_type = 'webhooks' THEN pl.webhooks_enabled
      WHEN p_limit_type = 'kanban' THEN pl.kanban_enabled
      WHEN p_limit_type = 'custom_branding' THEN pl.custom_branding
      WHEN p_limit_type = 'api_access' THEN pl.api_access_enabled
      ELSE false
    END
  INTO v_feature_enabled
  FROM subscriptions s
  JOIN plan_limits pl ON pl.plan_id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT
      CASE
        WHEN p_limit_type = 'portal' THEN pl.portal_enabled
        WHEN p_limit_type = 'whatsapp' THEN pl.whatsapp_enabled
        WHEN p_limit_type = 'webhooks' THEN pl.webhooks_enabled
        WHEN p_limit_type = 'kanban' THEN pl.kanban_enabled
        WHEN p_limit_type = 'custom_branding' THEN pl.custom_branding
        WHEN p_limit_type = 'api_access' THEN pl.api_access_enabled
        ELSE false
      END
    INTO v_feature_enabled
    FROM plans p
    JOIN plan_limits pl ON pl.plan_id = p.id
    WHERE p.name = 'fremium'
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_feature_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. POLICIES PARA WEBMASTER
-- ============================================

CREATE OR REPLACE FUNCTION is_webmaster(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'webmaster'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can view own clients" ON clients;
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_webmaster(auth.uid()));

DROP POLICY IF EXISTS "Users can update own clients" ON clients;
CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR is_webmaster(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR is_webmaster(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own clients" ON clients;
CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR is_webmaster(auth.uid()));

DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
CREATE POLICY "Users can view own meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    is_webmaster(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM clients WHERE clients.id = meetings.client_id AND clients.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    is_webmaster(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM clients WHERE clients.id = tasks.client_id AND clients.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_webmaster(auth.uid()));

CREATE POLICY "Webmasters can update any subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (is_webmaster(auth.uid()))
  WITH CHECK (is_webmaster(auth.uid()));
