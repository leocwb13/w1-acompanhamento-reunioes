import { useEffect, useState } from 'react';
import { Users, AlertCircle, Clock, Plus, Search } from 'lucide-react';
import { listClients, createClient } from '../services/clientService';
import { useToast } from '../lib/toast';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientListProps {
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  refreshTrigger: number;
}

type FilterType = 'all' | 'high_risk' | 'no_advance';

export default function ClientList({ selectedClientId, onSelectClient, refreshTrigger }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  useEffect(() => {
    loadClients();
  }, [filter, refreshTrigger]);

  const loadClients = async () => {
    setLoading(true);
    try {
      let filterParams = {};

      if (filter === 'high_risk') {
        filterParams = { risk_level: 'high' };
      } else if (filter === 'no_advance') {
        filterParams = { no_advance_days: 30 };
      }

      const data = await listClients(filterParams);
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'bg-red-100 text-red-800 border-red-300';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'Alto';
    if (score >= 40) return 'Médio';
    return 'Baixo';
  };

  const getDaysSinceActivity = (lastActivityDate: string | null) => {
    if (!lastActivityDate) return null;
    const lastActivity = new Date(lastActivityDate);
    const today = new Date();
    return Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Clientes</h2>
          </div>
          <button
            onClick={() => setShowNewClientModal(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Novo Cliente"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('high_risk')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'high_risk'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alto Risco
          </button>
          <button
            onClick={() => setFilter('no_advance')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'no_advance'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            30+ dias
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Nenhum cliente encontrado
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {filteredClients.map((client) => {
              const days = getDaysSinceActivity(client.last_activity_date);
              const isSelected = client.id === selectedClientId;
              const initials = client.name
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              const riskColorClasses = {
                text: client.risk_score >= 70 ? 'text-red-600' : client.risk_score >= 40 ? 'text-yellow-600' : 'text-green-600',
                bg: client.risk_score >= 70 ? 'bg-red-50' : client.risk_score >= 40 ? 'bg-yellow-50' : 'bg-green-50',
                border: client.risk_score >= 70 ? 'border-red-200' : client.risk_score >= 40 ? 'border-yellow-200' : 'border-green-200',
              };

              return (
                <button
                  key={client.id}
                  onClick={() => onSelectClient(client.id)}
                  className={`w-full p-4 text-left rounded-xl transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 shadow-md'
                      : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                    }`}>
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{client.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full border ${riskColorClasses.bg} ${riskColorClasses.text} ${riskColorClasses.border}`}
                        >
                          {getRiskLabel(client.risk_score)}
                        </span>
                      </div>

                      {client.status && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                            client.status === 'ativo' ? 'bg-green-100 text-green-800' :
                            client.status === 'inativo' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {client.status === 'ativo' ? 'Ativo' : client.status === 'inativo' ? 'Inativo' : 'Prospecto'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs">
                        {days !== null && (
                          <div className={`flex items-center gap-1 ${days > 30 ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{days}d sem atividade</span>
                          </div>
                        )}
                        {client.risk_score >= 70 && (
                          <div className="flex items-center gap-1 text-red-600 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Requer atenção</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onSuccess={() => {
            setShowNewClientModal(false);
            loadClients();
          }}
        />
      )}
    </aside>
  );
}

function NewClientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await createClient({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined
      });
      showToast('Cliente criado com sucesso', 'success');
      onSuccess();
    } catch (error) {
      console.error('Error creating client:', error);
      showToast('Erro ao criar cliente. Verifique os dados e tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Novo Cliente</h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
