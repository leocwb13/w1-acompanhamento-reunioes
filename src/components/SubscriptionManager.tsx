import { useState, useEffect } from 'react';
import { Users, Crown, Shield, Calendar, RotateCcw, Plus, Trash2, Search } from 'lucide-react';
import { getAllUsers, updateUserSubscription, toggleUserAdmin, resetUserCredits, extendSubscription, type UserWithSubscription } from '../services/adminService';
import { getPlans, type Plan } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../lib/toast';

export default function SubscriptionManager() {
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, plansData] = await Promise.all([
        getAllUsers(),
        getPlans()
      ]);
      setUsers(usersData);
      setPlans(plansData);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async (userId: string, planId: string) => {
    if (!user) return;

    try {
      await updateUserSubscription(userId, planId, user.id);
      showToast('Plano atualizado com sucesso', 'success');
      await loadData();
      setShowModal(false);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao atualizar plano', 'error');
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleUserAdmin(userId, !currentStatus);
      showToast(`Permissões de admin ${!currentStatus ? 'concedidas' : 'removidas'}`, 'success');
      await loadData();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao atualizar permissões', 'error');
    }
  };

  const handleResetCredits = async (userId: string) => {
    try {
      await resetUserCredits(userId);
      showToast('Créditos resetados com sucesso', 'success');
      await loadData();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao resetar créditos', 'error');
    }
  };

  const handleExtendSubscription = async (userId: string, days: number) => {
    try {
      await extendSubscription(userId, days);
      showToast(`Assinatura estendida por ${days} dias`, 'success');
      await loadData();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao estender assinatura', 'error');
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Gerenciar Usuários</h3>
            <p className="text-sm text-gray-600">{users.length} usuários cadastrados</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por email ou nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créditos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validade</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((userData) => (
                <tr key={userData.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{userData.full_name}</p>
                        {userData.is_admin && (
                          <Shield className="w-4 h-4 text-amber-500" title="Administrador" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{userData.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {userData.subscription ? (
                      <div className="flex items-center gap-2">
                        {userData.subscription.plan?.credits_per_month === null && (
                          <Crown className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {userData.subscription.plan?.display_name || 'N/A'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Sem plano</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {userData.subscription?.plan?.credits_per_month ? (
                      <span className="text-sm text-gray-700">
                        {userData.subscription.credits_used} / {userData.subscription.plan.credits_per_month}
                      </span>
                    ) : (
                      <span className="text-sm text-green-600 font-medium">Ilimitado</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {userData.subscription ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        userData.subscription.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {userData.subscription.status === 'active' ? 'Ativo' : userData.subscription.status}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {userData.subscription ? (
                      <span className="text-sm text-gray-700">
                        {formatDate(userData.subscription.current_period_end)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(userData);
                          setShowModal(true);
                        }}
                        className="p-1 hover:bg-blue-50 rounded text-blue-600"
                        title="Alterar plano"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {userData.subscription?.plan?.credits_per_month && (
                        <button
                          onClick={() => handleResetCredits(userData.id)}
                          className="p-1 hover:bg-green-50 rounded text-green-600"
                          title="Resetar créditos"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {userData.subscription && (
                        <button
                          onClick={() => handleExtendSubscription(userData.id, 30)}
                          className="p-1 hover:bg-purple-50 rounded text-purple-600"
                          title="Estender 30 dias"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleAdmin(userData.id, userData.is_admin)}
                        className={`p-1 rounded ${
                          userData.is_admin
                            ? 'hover:bg-red-50 text-red-600'
                            : 'hover:bg-amber-50 text-amber-600'
                        }`}
                        title={userData.is_admin ? 'Remover admin' : 'Tornar admin'}
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Alterar Plano - {selectedUser.full_name}
              </h3>
            </div>
            <div className="p-6 space-y-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => handleChangePlan(selectedUser.id, plan.id)}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{plan.display_name}</p>
                      <p className="text-sm text-gray-600">{plan.description}</p>
                      {plan.credits_per_month ? (
                        <p className="text-xs text-gray-500 mt-1">
                          {plan.credits_per_month} créditos/mês
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          Créditos ilimitados
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {plan.price_monthly > 0 ? `R$ ${plan.price_monthly}` : 'Grátis'}
                      </p>
                      <p className="text-xs text-gray-500">/mês</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
