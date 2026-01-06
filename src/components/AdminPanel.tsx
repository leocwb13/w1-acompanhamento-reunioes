import { useState, useEffect } from 'react';
import { Settings, Save, X, Eye, EyeOff, CreditCard, FileText, User, CheckCircle, XCircle, Loader2, Users, Calendar } from 'lucide-react';
import { getAllSettings, updateSetting, type Setting, getOpenAIKey, getSetting } from '../services/settingsService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../lib/toast';
import PromptEditor from './PromptEditor';
import PlanSelector from './PlanSelector';
import SubscriptionManager from './SubscriptionManager';
import MeetingTypesManager from './MeetingTypesManager';
import { testOpenAIConnection } from '../lib/openai';

interface AdminPanelProps {
  onClose: () => void;
}

type TabType = 'general' | 'prompts' | 'meeting_types' | 'subscription' | 'users';

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const { user, profile, subscription, refreshSubscription } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [keySource, setKeySource] = useState<string>('');
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const { showToast } = useToast();

  useEffect(() => {
    loadSettings();
    checkKeySource();
  }, []);

  const checkKeySource = async () => {
    try {
      const userKey = await getSetting('openai_api_key');
      const envKey = import.meta.env.VITE_OPENAI_API_KEY;

      if (userKey && userKey.trim() !== '' && userKey !== 'your_openai_api_key_here') {
        setKeySource('✓ Usando sua chave pessoal configurada');
      } else if (envKey && envKey.trim() !== '' && envKey !== 'your_openai_api_key_here') {
        setKeySource('✓ Usando chave global do sistema (você pode configurar uma chave pessoal se desejar)');
      } else {
        setKeySource('⚠ Nenhuma chave configurada');
      }
    } catch (error) {
      setKeySource('⚠ Erro ao verificar origem da chave');
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getAllSettings();

      if (data.length === 0) {
        setSettings([
          {
            id: 'temp-openai-key',
            key: 'openai_api_key',
            value: '',
            description: 'Chave OpenAI pessoal (opcional - deixe em branco para usar a chave do sistema)',
            user_id: user?.id || null,
            updated_at: new Date().toISOString()
          }
        ]);
      } else {
        const hasOpenAIKey = data.some(s => s.key === 'openai_api_key');
        if (!hasOpenAIKey) {
          setSettings([
            ...data,
            {
              id: 'temp-openai-key',
              key: 'openai_api_key',
              value: '',
              description: 'Chave OpenAI pessoal (opcional - deixe em branco para usar a chave do sistema)',
              user_id: user?.id || null,
              updated_at: new Date().toISOString()
            }
          ]);
        } else {
          setSettings(data);
        }
      }
    } catch (error) {
      showToast('Erro ao carregar configurações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev =>
      prev.map(s => (s.key === key ? { ...s, value } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      for (const setting of settings) {
        if (setting.value !== null && setting.value !== undefined && setting.value.trim() !== '') {
          await updateSetting(setting.key, setting.value);
        }
      }

      showToast('Configurações salvas com sucesso', 'success');
      await loadSettings();
      await checkKeySource();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testOpenAIConnection();
      if (result.success) {
        setTestResult({
          success: true,
          message: `Conexão bem-sucedida! Modelo: ${result.model}`
        });
        showToast('Conexão com OpenAI funcionando!', 'success');
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Falha ao conectar'
        });
        showToast('Falha ao conectar com OpenAI', 'error');
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error?.message || 'Erro ao testar conexão'
      });
      showToast('Erro ao testar conexão', 'error');
    } finally {
      setTesting(false);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getInputType = (key: string) => {
    if (key.includes('api_key') || key.includes('secret')) {
      return showKeys[key] ? 'text' : 'password';
    }
    return 'text';
  };

  const isApiKey = (key: string) => {
    return key.includes('api_key') || key.includes('secret');
  };

  const getSetting = async (key: string) => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || null;
  };



  const tabs = [
    { id: 'general' as TabType, label: 'Geral', icon: Settings },
    { id: 'prompts' as TabType, label: 'Prompts', icon: FileText },
    { id: 'meeting_types' as TabType, label: 'Tipos de Reunião', icon: Calendar },
    { id: 'subscription' as TabType, label: 'Assinatura', icon: CreditCard },
    ...(profile?.is_admin ? [{ id: 'users' as TabType, label: 'Usuários', icon: Users }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Configurações</h2>
              <p className="text-sm text-gray-600 mt-1">
                {profile?.full_name || user?.email}
              </p>
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
                  onClick={() => setCurrentTab(tab.id)}
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
          {currentTab === 'general' && (
            loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>Pronto para usar!</strong> O sistema já está configurado com uma chave OpenAI compartilhada. Você pode começar a usar imediatamente ou configurar sua própria chave pessoal abaixo (opcional).
                    </p>
                  </div>

                  {keySource && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-900 mb-1">Status da Chave OpenAI</p>
                      <p className="text-sm text-blue-800">{keySource}</p>
                    </div>
                  )}

                  {testResult && (
                    <div className={`rounded-lg p-3 border ${
                      testResult.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${
                            testResult.success ? 'text-green-900' : 'text-red-900'
                          }`}>
                            {testResult.success ? 'Teste Bem-Sucedido' : 'Teste Falhou'}
                          </p>
                          <p className={`text-xs mt-1 ${
                            testResult.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {testResult.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {settings.map(setting => (
                  <div key={setting.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        {setting.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </label>
                      {isApiKey(setting.key) && (
                        <button
                          onClick={() => toggleShowKey(setting.key)}
                          className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                        >
                          {showKeys[setting.key] ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Ocultar
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              Mostrar
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {setting.description && (
                      <p className="text-xs text-gray-500">{setting.description}</p>
                    )}
                    <input
                      type={getInputType(setting.key)}
                      value={setting.value || ''}
                      onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                      placeholder={isApiKey(setting.key) ? 'sk-...' : 'Digite o valor'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                ))}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 text-sm mb-2">Chave OpenAI Pessoal (Opcional)</h3>
                  <p className="text-xs text-blue-800 mb-2">
                    O sistema já possui uma chave configurada para todos os usuários. Você só precisa configurar sua própria chave se desejar usar sua conta pessoal da OpenAI.
                  </p>
                  <details className="text-xs text-blue-800">
                    <summary className="cursor-pointer font-medium mb-1">Como obter sua própria chave</summary>
                    <ol className="space-y-1 list-decimal list-inside mt-2 ml-2">
                      <li>Acesse <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a></li>
                      <li>Faça login ou crie uma conta</li>
                      <li>Clique em "Create new secret key"</li>
                      <li>Copie a chave e cole no campo acima</li>
                    </ol>
                  </details>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleTestConnection}
                    className="flex-1 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={testing || saving}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Testar Conexão
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={saving || testing}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Salvar Configurações
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          )}

          {currentTab === 'prompts' && <PromptEditor />}
          {currentTab === 'meeting_types' && <MeetingTypesManager />}
          {currentTab === 'users' && profile?.is_admin && <SubscriptionManager />}

          {currentTab === 'subscription' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Plano Atual</h3>
                {subscription && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-blue-900">{subscription.plan?.display_name}</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        subscription.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {subscription.status === 'active' ? 'Ativo' : subscription.status}
                      </span>
                    </div>
                    {subscription.plan?.credits_per_month && (
                      <p className="text-sm text-blue-800">
                        Créditos usados: {subscription.credits_used} / {subscription.plan.credits_per_month}
                      </p>
                    )}
                    {!subscription.plan?.credits_per_month && (
                      <p className="text-sm text-blue-800">Créditos ilimitados</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Planos Disponíveis</h3>
                {user && (
                  <PlanSelector
                    userId={user.id}
                    currentPlanName={subscription?.plan?.name}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {currentTab !== 'general' && (
          <div className="flex gap-3 p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
