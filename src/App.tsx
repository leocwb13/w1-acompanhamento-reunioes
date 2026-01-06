import { useState } from 'react';
import { Users, CheckSquare, Calendar, CreditCard, ChevronDown, Settings, LogOut, Webhook } from 'lucide-react';
import ClientList from './components/ClientList';
import ChatInterface from './components/ChatInterface';
import ClientPanel from './components/ClientPanel';
import AdminPanel from './components/AdminPanel';
import ProfileMenu from './components/ProfileMenu';
import AllTasksView from './components/AllTasksView';
import AllMeetingsView from './components/AllMeetingsView';
import WebhookPanel from './components/WebhookPanel';
import AuthWrapper from './components/AuthWrapper';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './lib/toast';
import { signOut } from './services/authService';

type View = 'clients' | 'tasks' | 'meetings' | 'webhooks';

function AppContent() {
  const { profile, subscription } = useAuth();
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<View>('clients');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair?')) {
      await signOut();
      showToast('Logout realizado com sucesso', 'success');
    }
  };

  const creditsRemaining = subscription?.plan?.credits_per_month
    ? (subscription.plan.credits_per_month - (subscription.credits_used || 0))
    : null;

  return (
    <div className="flex h-screen bg-gray-50">
      {currentView === 'clients' && (
        <ClientList
          selectedClientId={selectedClientId}
          onSelectClient={setSelectedClientId}
          refreshTrigger={refreshTrigger}
        />
      )}

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Assistente Operacional W1</h1>
              <p className="text-sm text-gray-600 mt-1">Clareza, Continuidade e Controle de Clientes</p>
            </div>
            <div className="flex items-center gap-3">
              {creditsRemaining !== null && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    {creditsRemaining} {creditsRemaining === 1 ? 'crédito' : 'créditos'}
                  </span>
                </div>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[150px] truncate">
                    {profile?.full_name || 'Usuário'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showProfileDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowProfileDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={() => {
                          setShowProfile(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        Meu Perfil
                      </button>
                      {profile?.is_admin && (
                        <button
                          onClick={() => {
                            setShowAdmin(true);
                            setShowProfileDropdown(false);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Configurações Técnicas
                        </button>
                      )}
                      <div className="border-t border-gray-200 my-1" />
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1 px-6">
            <button
              onClick={() => handleViewChange('clients')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                currentView === 'clients'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="font-medium">Clientes</span>
            </button>
            <button
              onClick={() => handleViewChange('tasks')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                currentView === 'tasks'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="font-medium">Tarefas</span>
            </button>
            <button
              onClick={() => handleViewChange('meetings')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                currentView === 'meetings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Reuniões</span>
            </button>
            <button
              onClick={() => handleViewChange('webhooks')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                currentView === 'webhooks'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Webhook className="w-4 h-4" />
              <span className="font-medium">Webhooks</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {currentView === 'clients' && (
            <ChatInterface
              selectedClientId={selectedClientId}
              onRefresh={handleRefresh}
            />
          )}
          {currentView === 'tasks' && (
            <AllTasksView
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onClearClient={() => setSelectedClientId(null)}
            />
          )}
          {currentView === 'meetings' && (
            <AllMeetingsView
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onClearClient={() => setSelectedClientId(null)}
            />
          )}
          {currentView === 'webhooks' && <WebhookPanel />}
        </div>
      </main>

      {currentView === 'clients' && selectedClientId && (
        <ClientPanel
          clientId={selectedClientId}
          onRefresh={handleRefresh}
          onClientDeleted={() => {
            setSelectedClientId(null);
            handleRefresh();
          }}
        />
      )}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showProfile && (
        <ProfileMenu
          onClose={() => setShowProfile(false)}
          onOpenSettings={() => {
            setShowProfile(false);
            setShowAdmin(true);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthWrapper>
      <AppContent />
    </AuthWrapper>
  );
}
