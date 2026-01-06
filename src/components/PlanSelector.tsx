import { useState, useEffect } from 'react';
import { Check, Crown, Zap, Loader2 } from 'lucide-react';
import { getPlans, type Plan } from '../services/subscriptionService';
import { createCheckoutSession, redirectToCheckout } from '../services/paymentService';
import { useToast } from '../lib/toast';

interface PlanSelectorProps {
  userId: string;
  currentPlanName?: string;
}

export default function PlanSelector({ userId, currentPlanName }: PlanSelectorProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await getPlans();
      setPlans(data);
    } catch (error) {
      showToast('Erro ao carregar planos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (plan.name === 'free') {
      showToast('Você já está no plano gratuito ou pode fazer downgrade pelo portal de assinatura', 'info');
      return;
    }

    setProcessingPlanId(planId);
    try {
      const { sessionId } = await createCheckoutSession(planId, userId);
      await redirectToCheckout(sessionId);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao processar pagamento', 'error');
      setProcessingPlanId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {plans.map((plan) => {
        const isCurrent = currentPlanName === plan.name;
        const isFree = plan.name === 'free';
        const isPro = plan.name === 'pro';

        return (
          <div
            key={plan.id}
            className={`relative rounded-lg border-2 p-6 ${
              isPro
                ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-white'
                : 'border-gray-200 bg-white'
            }`}
          >
            {isPro && (
              <div className="absolute top-0 right-0 -mt-3 -mr-3">
                <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  RECOMENDADO
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              {isFree && <Zap className="w-6 h-6 text-gray-600" />}
              {isPro && <Crown className="w-6 h-6 text-blue-600" />}
              <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  R$ {plan.price_monthly.toFixed(2)}
                </span>
                <span className="text-gray-600">/mês</span>
              </div>
              {plan.credits_per_month && (
                <p className="text-sm text-gray-600 mt-1">
                  {plan.credits_per_month} créditos por mês
                </p>
              )}
              {!plan.credits_per_month && (
                <p className="text-sm text-blue-600 mt-1 font-medium">
                  Créditos ilimitados
                </p>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-6">{plan.description}</p>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <button
                disabled
                className="w-full px-4 py-3 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed"
              >
                Plano Atual
              </button>
            ) : (
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={processingPlanId !== null}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  isPro
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {processingPlanId === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  isPro ? 'Fazer Upgrade' : 'Selecionar Plano'
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
