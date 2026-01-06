/*
  # Configurações por Usuário

  ## 1. Alterações
  
  ### Modificar tabela `settings`
  - Adicionar `user_id` (uuid, opcional)
  - Quando user_id for NULL, é configuração global/padrão
  - Quando user_id tiver valor, é configuração específica do usuário
  - Criar índice para otimizar buscas por user_id

  ## 2. Security
  - Atualizar RLS policies para permitir usuários lerem configurações globais
  - Permitir usuários gerenciarem apenas suas próprias configurações
*/

-- Adicionar coluna user_id à tabela settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE settings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Atualizar RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON settings;
DROP POLICY IF EXISTS "Enable insert for all users" ON settings;
DROP POLICY IF EXISTS "Enable update for all users" ON settings;

-- Usuários podem ler configurações globais (user_id NULL) e suas próprias
CREATE POLICY "Users can read global and own settings"
  ON settings FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- Usuários podem inserir suas próprias configurações
CREATE POLICY "Users can insert own settings"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias configurações
CREATE POLICY "Users can update own settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar suas próprias configurações
CREATE POLICY "Users can delete own settings"
  ON settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
