/*
  # Adicionar papel de administrador e melhorias no gerenciamento de assinaturas

  1. Alterações
    - Adiciona coluna `is_admin` na tabela `user_profiles`
    - Adiciona índice para facilitar queries de administradores
    - Adiciona coluna `managed_by` em `subscriptions` para rastrear quem alterou a assinatura
    
  2. Segurança
    - RLS continua protegendo acesso aos dados
    - Apenas administradores podem ver/modificar assinaturas de outros usuários
*/

-- Adicionar coluna is_admin se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Criar índice para facilitar busca de admins
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = true;

-- Adicionar coluna managed_by em subscriptions se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'managed_by'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN managed_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Adicionar índice para managed_by
CREATE INDEX IF NOT EXISTS idx_subscriptions_managed_by ON subscriptions(managed_by);

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy para admins verem todos os perfis
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid()) OR auth.uid() = id
  );

-- Policy para admins verem todas as assinaturas
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid()) OR auth.uid() = user_id
  );

-- Policy para admins atualizarem assinaturas de outros
DROP POLICY IF EXISTS "Admins can update any subscription" ON subscriptions;
CREATE POLICY "Admins can update any subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Policy para admins criarem assinaturas
DROP POLICY IF EXISTS "Admins can insert subscriptions" ON subscriptions;
CREATE POLICY "Admins can insert subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR auth.uid() = user_id);
