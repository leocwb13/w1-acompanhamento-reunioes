import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { stripeProducts } from '../stripe-config';
import { supabase } from '../lib/supabase';

interface PricingCardProps {
  onCheckout?: (priceId: string) => void;
}

export function PricingCard({ onCheckout }: PricingCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const product = stripeProducts[0]; // We only have one product

  const handleCheckout = async () => {
    if (!onCheckout) return;
    
    setLoading(product.priceId);
    try {
      await onCheckout(product.priceId);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
      
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
        <p className="text-gray-600 mb-6">{product.description}</p>
        
        <div className="flex items-baseline justify-center mb-6">
          <span className="text-4xl font-bold text-gray-900">{product.currencySymbol}{product.price}</span>
          <span className="text-gray-500 ml-2">/mês</span>
        </div>
      </div>

      <ul className="space-y-4 mb-8">
        {product.features.map((feature, index) => (
          <li key={index} className="flex items-center">
            <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleCheckout}
        disabled={loading === product.priceId}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading === product.priceId ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processando...
          </>
        ) : (
          'Assinar Agora'
        )}
      </button>
    </div>
  );
}