/*
  # Corrigir políticas RLS da tabela settings

  ## 1. Alterações
  
  ### Remover política antiga conflitante
  - Remover "Allow all operations" que estava permitindo acesso público
  
  ### Manter apenas políticas específicas por usuário
  - Usuários podem ler configurações globais (user_id NULL) e suas próprias
  - Usuários podem inserir suas próprias configurações
  - Usuários podem atualizar suas próprias configurações
  - Usuários podem deletar suas próprias configurações

  ## 2. Security
  - Garantir que apenas usuários autenticados acessem suas próprias configurações
  - Configurações globais são read-only para todos
*/

-- Remover política antiga que permitia tudo
DROP POLICY IF EXISTS "Allow all operations" ON settings;

-- Garantir que as políticas corretas existam
DO $$
BEGIN
  -- Recriar política de leitura se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'settings' 
    AND policyname = 'Users can read global and own settings'
  ) THEN
    CREATE POLICY "Users can read global and own settings"
      ON settings FOR SELECT
      TO authenticated
      USING (user_id IS NULL OR auth.uid() = user_id);
  END IF;

  -- Recriar política de insert se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'settings' 
    AND policyname = 'Users can insert own settings'
  ) THEN
    CREATE POLICY "Users can insert own settings"
      ON settings FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Recriar política de update se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'settings' 
    AND policyname = 'Users can update own settings'
  ) THEN
    CREATE POLICY "Users can update own settings"
      ON settings FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Recriar política de delete se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'settings' 
    AND policyname = 'Users can delete own settings'
  ) THEN
    CREATE POLICY "Users can delete own settings"
      ON settings FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
