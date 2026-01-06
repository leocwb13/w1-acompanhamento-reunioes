/*
  # Remover Sistema de Diagnóstico de Marketing

  1. Remoção de Tabelas
    - Remove `pillar_improvements` (depende de pillars)
    - Remove `pillar_scores` (depende de pillars)
    - Remove `pillars` (tabela principal de pilares de marketing)
    - Remove `custom_pillars` (pilares customizados do usuário)

  2. Modificação de Tabelas Existentes
    - Remove coluna `pillar` da tabela `tasks`

  3. Motivo
    - Sistema de diagnóstico de marketing não é relevante para o propósito do projeto
    - Limpeza de código e banco de dados para manter foco no core business
*/

-- Remover tabelas de pilares de marketing na ordem correta (foreign keys primeiro)

DROP TABLE IF EXISTS pillar_improvements CASCADE;
DROP TABLE IF EXISTS pillar_scores CASCADE;
DROP TABLE IF EXISTS pillars CASCADE;
DROP TABLE IF EXISTS custom_pillars CASCADE;

-- Remover coluna pillar da tabela tasks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'pillar'
  ) THEN
    ALTER TABLE tasks DROP COLUMN pillar;
  END IF;
END $$;
