/*
  # Atualizar valores dos planos para preços corretos

  ## Correção de Preços
  Ajustando os valores para os preços reais desejados:
  
  - Fremium: R$ 0,00 (gratuito)
  - Standard: R$ 74,95 (setenta e cinco reais e noventa e cinco centavos)
  - Premium: R$ 99,95 (noventa e nove reais e noventa e cinco centavos)
  - Infinity: R$ 149,90 (cento e quarenta e nove reais e noventa centavos)
  - Private: R$ 269,90 (duzentos e sessenta e nove reais e noventa centavos)

  ## Security
  - Apenas atualização de valores, sem mudanças em RLS
*/

-- Atualizar valores para os preços corretos
UPDATE plans SET price_monthly = 0.00 WHERE name = 'fremium';
UPDATE plans SET price_monthly = 74.95 WHERE name = 'standard';
UPDATE plans SET price_monthly = 99.95 WHERE name IN ('premium', 'pro');
UPDATE plans SET price_monthly = 149.90 WHERE name = 'infinity';
UPDATE plans SET price_monthly = 269.90 WHERE name = 'private';
