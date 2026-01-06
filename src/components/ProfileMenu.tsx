import { useState, useEffect } from 'react';
import { User, CreditCard, History, ExternalLink, X, AlertTriangle, Settings, Eye, EyeOff, Save, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createCustomerPortalSession, getUserPaymentTransactions, formatCurrency, formatDate, type PaymentTransaction } from '../services/paymentService';
import { cancelSubscription as cancelUserSubscription } from '../services/subscriptionService';
import { useToast } from '../lib/toast';
import PlanSelector from './PlanSelector';
import { updateSetting } from '../services/settingsService';
import { supabase } from '../lib/supabase';
import PromptEditor from './PromptEditor';
import { resetOpenAI, testOpenAIConnection } from '../lib/openai';

interface ProfileMenuProps {
  onClose: () => void;
  onOpenSettings: () => void;
}

type TabType = 'profile' | 'subscription' | 'history' | 'settings' | 'prompts';

export default function ProfileMenu({ onClose, onOpenSettings }: ProfileMenuProps) {
  const { user, profile, subscription, refreshSubscription } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('profile');
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { showToast } = useToast();

  const loadTransactions = async () => {
    if (!user) return;
    setLoadingTransactions(true);
    try {
      const data = await getUserPaymentTransactions(user.id);
      setTransactions(data);
    } catch (error: any) {
      showToast('Erro ao carregar histórico', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!user) return;
    setLoadingPortal(true);
    try {
      const { url } = await createCustomerPortalSession(user.id);
      window.open(url, '_blank');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao abrir portal', 'error');
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    setLoadingCancel(true);
    try {
      await cancelUserSubscription(user.id);
      await refreshSubscription();
      showToast('Assinatura cancelada com sucesso. O acesso continuará até o fim do período.', 'success');
      setShowCancelModal(false);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao cancelar assinatura', 'error');
    } finally {
      setLoadingCancel(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    if (tab === 'history' && transactions.length === 0) {
      loadTransactions();
    }
  };

  const creditsRemaining = subscription?.plan?.credits_per_month
    ? (subscription.plan.credits_per_month - (subscription.credits_used || 0))
    : null;

  const loadSettings = async () => {
    if (!user) return;
    setLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setOpenaiKey(data?.value || '');
    } catch (error: any) {
      showToast('Erro ao carregar configurações', 'error');
      setOpenaiKey('');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    if (!openaiKey.trim()) {
      showToast('Por favor, insira uma chave de API válida', 'error');
      return;
    }

    if (!openaiKey.trim().startsWith('sk-')) {
      showToast('A chave da OpenAI deve começar com "sk-"', 'error');
      return;
    }

    setSavingSettings(true);
    setConnectionStatus('idle');
    try {
      await updateSetting('openai_api_key', openaiKey.trim());
      await resetOpenAI();
      showToast('Chave salva com sucesso! O cache foi limpo.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao salvar configurações', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    if (!openaiKey.trim()) {
      showToast('Salve a chave antes de testar', 'error');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const result = await testOpenAIConnection();
      if (result.success) {
        setConnectionStatus('success');
        showToast(`Conexão OK! Modelo: ${result.model}`, 'success');
      } else {
        setConnectionStatus('error');
        showToast(`Erro: ${result.error}`, 'error');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      showToast(error?.message || 'Erro ao testar conexão', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'settings') {
      loadSettings();
    }
  }, [currentTab, user]);

  const tabs = [
    { id: 'profile' as TabType, label: 'Perfil', icon: User },
    { id: 'subscription' as TabType, label: 'Assinatura', icon: CreditCard },
    { id: 'prompts' as TabType, label: 'Prompts', icon: FileText },
    { id: 'settings' as TabType, label: 'API', icon: Settings },
    { id: 'history' as TabType, label: 'Histórico', icon: History },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{profile?.full_name}</h2>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-1 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    currentTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Pessoais</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={profile?.full_name || ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {currentTab === 'subscription' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Plano Atual</h3>
                {subscription ? (
                  <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">{subscription.plan?.display_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{subscription.plan?.description}</p>
                      </div>
                      <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                        subscription.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {subscription.status === 'active' ? 'Ativo' : subscription.status}
                      </span>
                    </div>

                    {creditsRemaining !== null && (
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Créditos Usados</span>
                          <span className="text-sm font-bold text-gray-900">
                            {subscription.credits_used} / {subscription.plan?.credits_per_month}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(
                                ((subscription.credits_used || 0) / (subscription.plan?.credits_per_month || 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {!creditsRemaining && (
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-green-800">Créditos Ilimitados</p>
                      </div>
                    )}

                    <div className="text-xs text-gray-600">
                      <p>Período atual: {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}</p>
                      {subscription.cancel_at_period_end && (
                        <p className="text-amber-600 font-medium mt-1">
                          Cancelamento agendado para o fim do período
                        </p>
                      )}
                    </div>

                    {subscription.stripe_customer_id && (
                      <div className="mt-4 space-y-2">
                        <button
                          onClick={handleOpenPortal}
                          disabled={loadingPortal}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {loadingPortal ? 'Abrindo...' : 'Gerenciar Assinatura'}
                          </span>
                        </button>

                        {subscription.plan?.name !== 'free' && !subscription.cancel_at_period_end && (
                          <button
                            onClick={() => setShowCancelModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium">Cancelar Assinatura</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600">Nenhuma assinatura ativa</p>
                )}
              </div>

              {subscription?.plan?.name !== 'pro' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Fazer Upgrade</h3>
                  {user && (
                    <PlanSelector
                      userId={user.id}
                      currentPlanName={subscription?.plan?.name}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {currentTab === 'history' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Pagamentos</h3>
                {loadingTransactions ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">Nenhuma transação encontrada</p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            {formatCurrency(transaction.amount, transaction.currency.toUpperCase())}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.status === 'succeeded'
                              ? 'bg-green-100 text-green-800'
                              : transaction.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.status === 'succeeded' ? 'Pago' : transaction.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p>{formatDate(transaction.created_at)}</p>
                          {transaction.payment_method_type && (
                            <p className="capitalize">{transaction.payment_method_type}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'prompts' && <PromptEditor />}

          {currentTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações de API</h3>
                {loadingSettings ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Chave de API da OpenAI
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          {showKey ? (
                            <EyeOff className="w-5 h-5 text-gray-500" />
                          ) : (
                            <Eye className="w-5 h-5 text-gray-500" />
                          )}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-600">
                        Sua chave de API é armazenada de forma segura e usada apenas para processar suas reuniões.
                        Obtenha sua chave em{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          platform.openai.com/api-keys
                        </a>
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings || !openaiKey.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingSettings ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Salvar
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleTestConnection}
                        disabled={testingConnection || !openaiKey.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testingConnection ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            Testando...
                          </>
                        ) : connectionStatus === 'success' ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Testado
                          </>
                        ) : connectionStatus === 'error' ? (
                          <>
                            <XCircle className="w-4 h-4" />
                            Erro
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Testar
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-900">
                        <strong>Dica:</strong> Configure sua própria chave de API para garantir disponibilidade e controle dos custos.
                        Os custos de uso da API são cobrados diretamente pela OpenAI.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Cancelar Assinatura</h3>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-gray-700">
                Tem certeza que deseja cancelar sua assinatura {subscription?.plan?.display_name}?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  <strong>Atenção:</strong> Após o cancelamento, você continuará com acesso aos recursos do plano atual até o dia{' '}
                  <strong>{subscription?.current_period_end ? formatDate(subscription.current_period_end) : ''}</strong>.
                  Depois disso, sua conta será automaticamente migrada para o plano Free com 3 créditos mensais.
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Você pode fazer upgrade novamente a qualquer momento.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={loadingCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Manter Assinatura
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={loadingCancel}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingCancel ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Cancelando...
                  </>
                ) : (
                  'Confirmar Cancelamento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
