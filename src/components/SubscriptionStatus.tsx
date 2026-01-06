import React from 'react';
import { Crown, Calendar, AlertCircle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

export function SubscriptionStatus() {
  const { subscription, plan, loading } = useSubscription();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!subscription || !plan) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
          <div>
            <h3 className="font-medium text-yellow-800">Nenhuma assinatura ativa</h3>
            <p className="text-sm text-yellow-700">Assine um plano para acessar todos os recursos</p>
          </div>
        </div>
      </div>
    );
  }

  const periodEnd = new Date(subscription.current_period_end);
  const isExpiringSoon = periodEnd.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <Crown className="w-5 h-5 text-purple-600 mr-3" />
          <div>
            <h3 className="font-medium text-gray-900">{plan.name}</h3>
            <p className="text-sm text-gray-600">
              Status: <span className="capitalize text-green-600 font-medium">{subscription.status}</span>
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            {plan.currencySymbol}{plan.price}/mês
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          <span>
            Próxima cobrança: {periodEnd.toLocaleDateString('pt-BR')}
          </span>
        </div>
        
        {subscription.cancel_at_period_end && (
          <div className="mt-2 text-sm text-orange-600">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Assinatura será cancelada no final do período
          </div>
        )}
        
        {isExpiringSoon && !subscription.cancel_at_period_end && (
          <div className="mt-2 text-sm text-yellow-600">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Renovação em breve
          </div>
        )}
      </div>
    </div>
  );
}