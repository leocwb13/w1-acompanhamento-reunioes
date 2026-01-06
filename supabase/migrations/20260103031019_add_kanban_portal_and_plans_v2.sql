/*
  # Sistema Kanban, Portal do Cliente e Planos Expandidos

  ## 1. Melhorias no Sistema de Tarefas (Kanban)
  
  ### Atualizações na tabela `tasks`
  - Adicionar `priority` (text) - valores: 'baixa', 'media', 'alta', 'urgente'
  - Adicionar `order_position` (integer) - para ordenação manual dos cards
  - Adicionar `assigned_date` (timestamptz) - data de atribuição
  - Adicionar `blocked` (boolean) - se tarefa está bloqueada
  - Adicionar `blocked_reason` (text) - motivo do bloqueio

  ## 2. Sistema de Portal do Cliente
  
  ### Nova tabela `client_portal_access`
  - `id` (uuid, primary key)
  - `client_id` (uuid, references clients)
  - `access_token` (uuid) - token único para acesso público
  - `enabled` (boolean) - se acesso está ativo
  - `last_access_at` (timestamptz) - último acesso
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 3. Sistema de Limites de Planos
  
  ### Nova tabela `plan_limits`
  - `plan_id` (uuid, references plans, primary key)
  - `max_clients` (integer) - null para ilimitado
  - `max_meetings_per_month` (integer) - null para ilimitado
  - `portal_enabled` (boolean)
  - `whatsapp_enabled` (boolean)
  - `webhooks_enabled` (boolean)
  - `kanban_enabled` (boolean)
  - `custom_branding` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 4. Configurações de WhatsApp
  
  ### Adições na tabela `settings`
  - Adicionar registros de configuração para WhatsApp (API key, instance ID, número padrão)

  ## 5. Novos Planos
  - Atualizar planos existentes
  - Adicionar planos: Gratuito, Essencial, Profissional, Enterprise

  ## 6. Security
  - Habilitar RLS nas novas tabelas
  - Adicionar policies apropriadas
  - Portal do cliente tem acesso público via token
*/

-- ============================================
-- 1. MELHORIAS NO SISTEMA DE TAREFAS (KANBAN)
-- ============================================

-- Adicionar novos campos na tabela tasks
DO $$
BEGIN
  -- Adicionar campo priority
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE tasks ADD COLUMN priority text DEFAULT 'media';
  END IF;

  -- Adicionar campo order_position
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'order_position'
  ) THEN
    ALTER TABLE tasks ADD COLUMN order_position integer DEFAULT 0;
  END IF;

  -- Adicionar campo assigned_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assigned_date'
  ) THEN
    ALTER TABLE tasks ADD COLUMN assigned_date timestamptz DEFAULT now();
  END IF;

  -- Adicionar campo blocked
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'blocked'
  ) THEN
    ALTER TABLE tasks ADD COLUMN blocked boolean DEFAULT false;
  END IF;

  -- Adicionar campo blocked_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'blocked_reason'
  ) THEN
    ALTER TABLE tasks ADD COLUMN blocked_reason text;
  END IF;
END $$;

-- Adicionar constraints para priority
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check 
      CHECK (priority IN ('baixa', 'media', 'alta', 'urgente'));
  END IF;
END $$;

-- Atualizar tasks existentes com order_position sequencial
UPDATE tasks 
SET order_position = subquery.rn 
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at) as rn
  FROM tasks
  WHERE order_position = 0
) AS subquery
WHERE tasks.id = subquery.id;

-- ============================================
-- 2. SISTEMA DE PORTAL DO CLIENTE
-- ============================================

-- Criar tabela client_portal_access
CREATE TABLE IF NOT EXISTS client_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  enabled boolean DEFAULT true,
  last_access_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_client_portal_access_token 
  ON client_portal_access(access_token);

-- Index para busca por client_id
CREATE INDEX IF NOT EXISTS idx_client_portal_access_client_id 
  ON client_portal_access(client_id);

-- RLS para client_portal_access
ALTER TABLE client_portal_access ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem gerenciar acesso dos seus clientes
CREATE POLICY "Users can manage portal access for their clients"
  ON client_portal_access FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_portal_access.client_id
      AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_portal_access.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Policy: Acesso público via token (para o portal)
CREATE POLICY "Public access via valid token"
  ON client_portal_access FOR SELECT
  TO anon
  USING (enabled = true);

-- ============================================
-- 3. SISTEMA DE LIMITES DE PLANOS
-- ============================================

-- Criar tabela plan_limits
CREATE TABLE IF NOT EXISTS plan_limits (
  plan_id uuid PRIMARY KEY REFERENCES plans(id) ON DELETE CASCADE,
  max_clients integer,
  max_meetings_per_month integer,
  portal_enabled boolean DEFAULT false,
  whatsapp_enabled boolean DEFAULT false,
  webhooks_enabled boolean DEFAULT false,
  kanban_enabled boolean DEFAULT false,
  custom_branding boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS para plan_limits
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Todos usuários autenticados podem ler limites dos planos
CREATE POLICY "Authenticated users can view plan limits"
  ON plan_limits FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Apenas admins podem modificar limites
CREATE POLICY "Only admins can modify plan limits"
  ON plan_limits FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- ============================================
-- 4. ATUALIZAR PLANOS E CRIAR LIMITES
-- ============================================

-- Atualizar plano Free existente
UPDATE plans 
SET 
  display_name = 'Gratuito',
  description = 'Ideal para começar',
  price_monthly = 0,
  credits_per_month = 10,
  features = '["5 clientes", "10 créditos/mês", "Resumos de reuniões básicos", "Suporte por email"]'::jsonb
WHERE name = 'free';

-- Criar ou atualizar plano Essencial
INSERT INTO plans (id, name, display_name, description, price_monthly, currency, credits_per_month, features, is_active)
VALUES (
  gen_random_uuid(),
  'essencial',
  'Essencial',
  'Para consultores em crescimento',
  9700,
  'BRL',
  50,
  '["20 clientes", "50 créditos/mês", "Portal do cliente básico", "Resumos avançados", "Suporte prioritário"]'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  credits_per_month = EXCLUDED.credits_per_month,
  features = EXCLUDED.features;

-- Criar ou atualizar plano Profissional
INSERT INTO plans (id, name, display_name, description, price_monthly, currency, credits_per_month, features, is_active)
VALUES (
  gen_random_uuid(),
  'profissional',
  'Profissional',
  'Solução completa para profissionais',
  19700,
  'BRL',
  150,
  '["50 clientes", "150 créditos/mês", "Portal completo", "Integração WhatsApp", "Webhooks", "Kanban avançado", "Suporte prioritário"]'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  credits_per_month = EXCLUDED.credits_per_month,
  features = EXCLUDED.features;

-- Criar ou atualizar plano Enterprise
INSERT INTO plans (id, name, display_name, description, price_monthly, currency, credits_per_month, features, is_active)
VALUES (
  gen_random_uuid(),
  'enterprise',
  'Enterprise',
  'Para empresas e equipes grandes',
  39700,
  'BRL',
  NULL,
  '["Clientes ilimitados", "Créditos ilimitados", "Todos os recursos", "Branding customizado", "API completa", "Suporte dedicado 24/7"]'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  credits_per_month = EXCLUDED.credits_per_month,
  features = EXCLUDED.features;

-- Inserir limites para cada plano
INSERT INTO plan_limits (plan_id, max_clients, max_meetings_per_month, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding)
SELECT id, 5, 10, false, false, false, true, false FROM plans WHERE name = 'free'
ON CONFLICT (plan_id) DO UPDATE SET
  max_clients = 5,
  max_meetings_per_month = 10,
  portal_enabled = false,
  whatsapp_enabled = false,
  webhooks_enabled = false,
  kanban_enabled = true,
  custom_branding = false;

INSERT INTO plan_limits (plan_id, max_clients, max_meetings_per_month, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding)
SELECT id, 20, 50, true, false, false, true, false FROM plans WHERE name = 'essencial'
ON CONFLICT (plan_id) DO UPDATE SET
  max_clients = 20,
  max_meetings_per_month = 50,
  portal_enabled = true,
  whatsapp_enabled = false,
  webhooks_enabled = false,
  kanban_enabled = true,
  custom_branding = false;

INSERT INTO plan_limits (plan_id, max_clients, max_meetings_per_month, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding)
SELECT id, 50, 150, true, true, true, true, false FROM plans WHERE name = 'profissional'
ON CONFLICT (plan_id) DO UPDATE SET
  max_clients = 50,
  max_meetings_per_month = 150,
  portal_enabled = true,
  whatsapp_enabled = true,
  webhooks_enabled = true,
  kanban_enabled = true,
  custom_branding = false;

INSERT INTO plan_limits (plan_id, max_clients, max_meetings_per_month, portal_enabled, whatsapp_enabled, webhooks_enabled, kanban_enabled, custom_branding)
SELECT id, NULL, NULL, true, true, true, true, true FROM plans WHERE name = 'enterprise'
ON CONFLICT (plan_id) DO UPDATE SET
  max_clients = NULL,
  max_meetings_per_month = NULL,
  portal_enabled = true,
  whatsapp_enabled = true,
  webhooks_enabled = true,
  kanban_enabled = true,
  custom_branding = true;

-- ============================================
-- 5. FUNÇÃO PARA VERIFICAR LIMITES DO PLANO
-- ============================================

CREATE OR REPLACE FUNCTION check_user_plan_limit(
  p_user_id uuid,
  p_limit_type text
) RETURNS boolean AS $$
DECLARE
  v_limit integer;
  v_current_count integer;
  v_feature_enabled boolean;
BEGIN
  -- Buscar o plano atual do usuário
  SELECT 
    CASE 
      WHEN p_limit_type = 'clients' THEN pl.max_clients
      WHEN p_limit_type = 'meetings' THEN pl.max_meetings_per_month
      ELSE NULL
    END,
    CASE 
      WHEN p_limit_type = 'portal' THEN pl.portal_enabled
      WHEN p_limit_type = 'whatsapp' THEN pl.whatsapp_enabled
      WHEN p_limit_type = 'webhooks' THEN pl.webhooks_enabled
      WHEN p_limit_type = 'kanban' THEN pl.kanban_enabled
      ELSE false
    END
  INTO v_limit, v_feature_enabled
  FROM subscriptions s
  JOIN plan_limits pl ON pl.plan_id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Se não encontrou assinatura, usar limites do plano free
  IF NOT FOUND THEN
    SELECT 
      CASE 
        WHEN p_limit_type = 'clients' THEN pl.max_clients
        WHEN p_limit_type = 'meetings' THEN pl.max_meetings_per_month
        ELSE NULL
      END,
      CASE 
        WHEN p_limit_type = 'portal' THEN pl.portal_enabled
        WHEN p_limit_type = 'whatsapp' THEN pl.whatsapp_enabled
        WHEN p_limit_type = 'webhooks' THEN pl.webhooks_enabled
        WHEN p_limit_type = 'kanban' THEN pl.kanban_enabled
        ELSE false
      END
    INTO v_limit, v_feature_enabled
    FROM plans p
    JOIN plan_limits pl ON pl.plan_id = p.id
    WHERE p.name = 'free'
    LIMIT 1;
  END IF;

  -- Se é verificação de feature booleana
  IF p_limit_type IN ('portal', 'whatsapp', 'webhooks', 'kanban') THEN
    RETURN COALESCE(v_feature_enabled, false);
  END IF;

  -- Se limite é NULL, significa ilimitado
  IF v_limit IS NULL THEN
    RETURN true;
  END IF;

  -- Contar uso atual
  IF p_limit_type = 'clients' THEN
    SELECT COUNT(*) INTO v_current_count
    FROM clients
    WHERE user_id = p_user_id;
  ELSIF p_limit_type = 'meetings' THEN
    SELECT COUNT(*) INTO v_current_count
    FROM meetings m
    JOIN clients c ON c.id = m.client_id
    WHERE c.user_id = p_user_id
      AND m.created_at >= date_trunc('month', CURRENT_DATE);
  ELSE
    RETURN false;
  END IF;

  -- Retornar se está dentro do limite
  RETURN v_current_count < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
