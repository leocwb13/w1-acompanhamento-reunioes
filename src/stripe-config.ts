export const stripeProducts = [
  {
    id: 'prod_TEkBkMO1RaCZyn',
    priceId: 'price_1SIGhMCTpfB6JxAnSYuHduru',
    name: 'Assistente de IA para Consultores Financeiros',
    description: 'Acompanhe todas as suas reuniões e acompanhe suas tarefas de consultoria tudo em um só lugar',
    price: 74.95,
    currency: 'BRL',
    currencySymbol: 'R$',
    mode: 'subscription' as const,
    features: [
      'Reuniões ilimitadas',
      'Análise automática de transcrições',
      'Geração de tarefas inteligentes',
      'Relatórios detalhados',
      'Suporte prioritário'
    ]
  }
];

export const getProductByPriceId = (priceId: string) => {
  return stripeProducts.find(product => product.priceId === priceId);
};

export const getProductById = (id: string) => {
  return stripeProducts.find(product => product.id === id);
};