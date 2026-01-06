/*
  # Corrigir constraint única da tabela settings

  ## 1. Problema
  
  A constraint `settings_key_key` impede que múltiplos usuários tenham a mesma chave (ex: openai_api_key)
  
  ## 2. Solução
  
  - Remover a constraint UNIQUE apenas em `key`
  - Adicionar constraint UNIQUE composta em `(key, user_id)`
  - Isso permite:
    - Cada usuário ter sua própria chave openai_api_key
    - Configurações globais (user_id NULL) continuam únicas
  
  ## 3. Notas
  
  - Configurações globais (user_id IS NULL) terão chave única
  - Cada usuário pode ter sua própria configuração com a mesma chave
  - Previne duplicatas: um usuário não pode ter duas configurações com a mesma chave
*/

-- Remover constraint antiga que só considera 'key'
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;

-- Adicionar constraint composta que considera key + user_id
-- Isso permite que diferentes usuários tenham a mesma chave
-- mas impede que o mesmo usuário tenha chaves duplicadas
ALTER TABLE settings ADD CONSTRAINT settings_key_user_id_key 
  UNIQUE (key, user_id);

-- Criar um índice parcial para configurações globais (user_id NULL)
-- Isso garante que configurações globais também sejam únicas
CREATE UNIQUE INDEX IF NOT EXISTS settings_key_global_unique 
  ON settings (key) 
  WHERE user_id IS NULL;
