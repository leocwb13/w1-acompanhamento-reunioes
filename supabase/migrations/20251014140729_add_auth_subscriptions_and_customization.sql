/*
  # Sistema de Autenticação, Assinaturas e Personalização

  ## 1. Novas Tabelas

  ### `user_profiles`
  - `id` (uuid, references auth.users)
  - `full_name` (text)
  - `company_name` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `plans`
  - `id` (uuid, primary key)
  - `name` (text) - "Free" ou "Pro"
  - `display_name` (text)
  - `description` (text)
  - `price_monthly` (numeric) - em centavos
  - `currency` (text) - "BRL"
  - `credits_per_month` (integer) - null para ilimitado
  - `features` (jsonb)
  - `is_active` (boolean)
  - `created_at` (timestamptz)

  ### `subscriptions`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `plan_id` (uuid, references plans)
  - `status` (text) - "active", "cancelled", "expired", "pending"
  - `current_period_start` (timestamptz)
  - `current_period_end` (timestamptz)
  - `credits_used` (integer)
  - `payment_provider_id` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `usage_logs`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `subscription_id` (uuid, references subscriptions)
  - `action_type` (text) - "meeting_processed", "email_generated", etc
  - `credits_consumed` (integer)
  - `metadata` (jsonb)
  - `created_at` (timestamptz)

  ### `prompt_templates`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, nullable para templates padrão)
  - `meeting_type` (text) - "C1", "C2", "C3", "C4", "FUP"
  - `system_prompt` (text)
  - `summary_instructions` (text)
  - `task_generation_instructions` (text)
  - `is_default` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `custom_pillars`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `pillar_number` (integer) - 1 a 4
  - `name` (text)
  - `description` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Security
  - Habilitar RLS em todas as novas tabelas
  - Policies para usuários autenticados acessarem apenas seus próprios dados
  - Policies para planos serem lidos por todos usuários autenticados
  - Atualizar RLS das tabelas existentes para filtrar por user_id

  ## 3. Dados Iniciais
  - Inserir planos Free e Pro
  - Inserir templates de prompts padrão para cada tipo de reunião
  - Inserir pilares padrão W1
*/

-- Criar tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  company_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Criar tabela de planos
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  price_monthly numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'BRL',
  credits_per_month integer,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by authenticated users"
  ON plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Criar tabela de assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status text DEFAULT 'active',
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '30 days'),
  credits_used integer DEFAULT 0,
  payment_provider_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'cancelled', 'expired', 'pending'))
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Criar tabela de logs de uso
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  credits_consumed integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage logs"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage logs"
  ON usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Criar tabela de templates de prompts
CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_type text NOT NULL,
  system_prompt text NOT NULL,
  summary_instructions text NOT NULL,
  task_generation_instructions text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_meeting_type CHECK (meeting_type IN ('C1', 'C2', 'C3', 'C4', 'FUP'))
);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prompt templates"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_default = true);

CREATE POLICY "Users can insert own prompt templates"
  ON prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompt templates"
  ON prompt_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompt templates"
  ON prompt_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Criar tabela de pilares personalizados
CREATE TABLE IF NOT EXISTS custom_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_number integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_pillar_number CHECK (pillar_number >= 1 AND pillar_number <= 4),
  CONSTRAINT unique_user_pillar UNIQUE (user_id, pillar_number)
);

ALTER TABLE custom_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom pillars"
  ON custom_pillars FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom pillars"
  ON custom_pillars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom pillars"
  ON custom_pillars FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom pillars"
  ON custom_pillars FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Adicionar user_id às tabelas existentes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_id ON prompt_templates(user_id, meeting_type);
CREATE INDEX IF NOT EXISTS idx_custom_pillars_user_id ON custom_pillars(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- Atualizar RLS policies das tabelas existentes para incluir user_id
DROP POLICY IF EXISTS "Enable read access for all users" ON clients;
DROP POLICY IF EXISTS "Enable insert for all users" ON clients;
DROP POLICY IF EXISTS "Enable update for all users" ON clients;
DROP POLICY IF EXISTS "Enable delete for all users" ON clients;

CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Atualizar RLS para meetings (vinculado via clients)
DROP POLICY IF EXISTS "Enable all access for all users" ON meetings;

CREATE POLICY "Users can view own meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = meetings.client_id AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = meetings.client_id AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = meetings.client_id AND clients.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = meetings.client_id AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = meetings.client_id AND clients.user_id = auth.uid()
  ));

-- Atualizar RLS para tasks (vinculado via clients)
DROP POLICY IF EXISTS "Enable all access for all users" ON tasks;

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = tasks.client_id AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = tasks.client_id AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = tasks.client_id AND clients.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = tasks.client_id AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = tasks.client_id AND clients.user_id = auth.uid()
  ));

-- Inserir planos padrão
INSERT INTO plans (name, display_name, description, price_monthly, credits_per_month, features)
VALUES 
  ('free', 'Plano Free', 'Experimente a plataforma gratuitamente com créditos limitados', 0.00, 3, 
   '["3 reuniões processadas por mês", "Acesso a todos os tipos de reunião", "Templates básicos de prompts", "Pilares padrão W1"]'::jsonb),
  ('pro', 'Plano Pro', 'Acesso ilimitado para consultores profissionais', 74.95, NULL,
   '["Reuniões ilimitadas", "Personalização completa de prompts", "Pilares customizáveis", "Suporte prioritário", "Relatórios avançados"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Inserir templates de prompts padrão
INSERT INTO prompt_templates (user_id, meeting_type, system_prompt, summary_instructions, task_generation_instructions, is_default)
VALUES
  (NULL, 'C1', 
   'Você é um assistente especializado em planejamento financeiro seguindo a metodologia W1. Para reuniões C1 (Análise), seu objetivo é mapear a situação atual do cliente, identificar dores e objetivos.',
   'Crie um resumo executivo em tópicos destacando: situação financeira atual, principais dores identificadas, objetivos declarados, e oportunidades de melhoria.',
   'Sugira tarefas SMART focadas em: organização de documentos financeiros, levantamento de despesas, identificação de fontes de renda, e agendamento de próxima reunião C2.',
   true),
  (NULL, 'C2',
   'Você é um assistente especializado em planejamento financeiro seguindo a metodologia W1. Para reuniões C2 (Proteção), seu objetivo é avaliar coberturas de seguro e riscos patrimoniais.',
   'Crie um resumo executivo em tópicos destacando: coberturas de seguro existentes, gaps de proteção identificados, riscos patrimoniais, e recomendações de blindagem.',
   'Sugira tarefas SMART focadas em: coleta de apólices vigentes, avaliação de beneficiários, cotação de seguros adicionais, e implementação de reservas de emergência.',
   true),
  (NULL, 'C3',
   'Você é um assistente especializado em planejamento financeiro seguindo a metodologia W1. Para reuniões C3 (Investimentos), seu objetivo é definir estratégia de alocação e liquidez.',
   'Crie um resumo executivo em tópicos destacando: perfil de investidor, horizonte temporal, objetivos de investimento, e alocação recomendada.',
   'Sugira tarefas SMART focadas em: definição de aportes mensais, abertura de contas de investimento, transferência de recursos, e acompanhamento de rentabilidade.',
   true),
  (NULL, 'C4',
   'Você é um assistente especializado em planejamento financeiro seguindo a metodologia W1. Para reuniões C4 (Consolidação), seu objetivo é revisar todo o planejamento e criar roadmap de 90 dias.',
   'Crie um resumo executivo em tópicos destacando: status de cada pilar (Fluxo, Proteção, Investimentos, Expansão), pendências críticas, e progresso geral.',
   'Sugira tarefas SMART focadas em: finalização de pendências, definição de milestones trimestrais, agendamento de follow-ups mensais, e métricas de acompanhamento.',
   true),
  (NULL, 'FUP',
   'Você é um assistente especializado em planejamento financeiro seguindo a metodologia W1. Para reuniões de Follow-up, seu objetivo é verificar progresso e criar micro-entregáveis.',
   'Crie um resumo executivo em tópicos destacando: tarefas concluídas desde último contato, bloqueios identificados, e próximos passos imediatos.',
   'Sugira tarefas SMART focadas em: 1 tarefa para o cliente, 1 tarefa para o consultor, e agendamento da próxima conversa. Mantenha escopo pequeno e acionável.',
   true)
ON CONFLICT DO NOTHING;