import { useEffect, useState } from 'react';
import { X, Link2, RefreshCw, Eye, EyeOff, Copy, Check } from 'lucide-react';
import {
  getPortalAccess,
  createPortalAccess,
  updatePortalAccess,
  regeneratePortalToken
} from '../services/portalService';
import { useToast } from '../lib/toast';

interface PortalAccessModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

export default function PortalAccessModal({ clientId, clientName, onClose }: PortalAccessModalProps) {
  const [loading, setLoading] = useState(true);
  const [portalAccess, setPortalAccess] = useState<any>(null);
  const [portalUrl, setPortalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadPortalAccess();
  }, [clientId]);

  const loadPortalAccess = async () => {
    try {
      setLoading(true);
      const access = await getPortalAccess(clientId);
      setPortalAccess(access);

      if (access) {
        const url = `${window.location.origin}/portal/${access.access_token}`;
        setPortalUrl(url);
      }
    } catch (error) {
      console.error('Error loading portal access:', error);
      showToast('Erro ao carregar acesso ao portal', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccess = async () => {
    try {
      setLoading(true);
      const access = await createPortalAccess(clientId);
      setPortalAccess(access);

      const url = `${window.location.origin}/portal/${access.access_token}`;
      setPortalUrl(url);

      showToast('Acesso ao portal criado com sucesso', 'success');
    } catch (error) {
      console.error('Error creating portal access:', error);
      showToast('Erro ao criar acesso ao portal', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async () => {
    if (!portalAccess) return;

    try {
      const newEnabled = !portalAccess.enabled;
      await updatePortalAccess(clientId, { enabled: newEnabled });
      setPortalAccess({ ...portalAccess, enabled: newEnabled });

      showToast(
        newEnabled ? 'Acesso ao portal ativado' : 'Acesso ao portal desativado',
        'success'
      );
    } catch (error) {
      console.error('Error toggling portal access:', error);
      showToast('Erro ao atualizar acesso', 'error');
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Tem certeza? O link antigo deixará de funcionar.')) return;

    try {
      setLoading(true);
      const access = await regeneratePortalToken(clientId);
      setPortalAccess(access);

      const url = `${window.location.origin}/portal/${access.access_token}`;
      setPortalUrl(url);

      showToast('Token regenerado com sucesso', 'success');
    } catch (error) {
      console.error('Error regenerating token:', error);
      showToast('Erro ao regenerar token', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    showToast('Link copiado para área de transferência', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Portal do Cliente</h2>
            <p className="text-sm text-gray-600 mt-1">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !portalAccess ? (
            <div className="text-center py-8">
              <Link2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Portal não configurado
              </h3>
              <p className="text-gray-600 mb-6">
                Crie um acesso ao portal para que seu cliente possa acompanhar as tarefas e reuniões
              </p>
              <button
                onClick={handleCreateAccess}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Criar Acesso ao Portal
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {portalAccess.enabled ? (
                    <Eye className="w-5 h-5 text-green-600" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {portalAccess.enabled ? 'Portal Ativo' : 'Portal Desativado'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {portalAccess.enabled
                        ? 'O cliente pode acessar o portal'
                        : 'O cliente não pode acessar o portal'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleAccess}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    portalAccess.enabled
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {portalAccess.enabled ? 'Desativar' : 'Ativar'}
                </button>
              </div>

              {portalAccess.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link de Acesso
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={portalUrl}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Compartilhe este link com seu cliente para que ele possa acessar o portal
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-3">Gerenciamento Avançado</h3>

                <button
                  onClick={handleRegenerateToken}
                  className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerar Token de Acesso
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Ao regenerar o token, o link antigo deixará de funcionar e um novo será gerado
                </p>
              </div>

              {portalAccess.last_access_at && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Último acesso:</span>{' '}
                    {new Date(portalAccess.last_access_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
