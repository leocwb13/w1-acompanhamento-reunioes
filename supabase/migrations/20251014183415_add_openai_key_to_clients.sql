/*
  # Adicionar chave OpenAI por cliente

  ## 1. Alterações
  
  ### Modificar tabela `clients`
  - Adicionar `openai_api_key` (text, opcional)
  - Cada cliente pode ter sua própria chave OpenAI
  - Se NULL, usa a chave do usuário como fallback

  ## 2. Security
  - Apenas o dono do cliente pode ver/editar a chave
  - RLS já está configurado para isolar dados por usuário
*/

-- Adicionar coluna openai_api_key à tabela clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'openai_api_key'
  ) THEN
    ALTER TABLE clients ADD COLUMN openai_api_key text;
  END IF;
END $$;
