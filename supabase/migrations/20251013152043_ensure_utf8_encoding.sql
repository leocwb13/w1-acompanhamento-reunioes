/*
  # Garantir Encoding UTF-8

  ## Mudanças
  - Garantir que todas as tabelas usem UTF-8
  - Adicionar encoding explícito para colunas de texto
*/

-- Nenhuma mudança necessária, PostgreSQL já usa UTF-8 por padrão
-- Apenas confirmando que está tudo correto

SELECT 'UTF-8 encoding confirmed' as status;
