import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  User
} from 'lucide-react';
import { getClientByToken, getPortalData } from '../services/portalService';
import type { Database } from '../lib/database.types';

type Task = Database['public']['Tables']['tasks']['Row'];
type Meeting = Database['public']['Tables']['meetings']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

const TASK_STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  em_revisao: 'Em Revisão',
  concluida: 'Concluída',
  cancelada: 'Cancelada'
};

const PRIORITY_COLORS: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-700',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700'
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  C1: 'C1 - Análise',
  C2: 'C2 - Proteção',
  C3: 'C3 - Investimentos',
  C4: 'C4 - Consolidação',
  FUP: 'Follow-up'
};

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    loadPortalData();
  }, [token]);

  const loadPortalData = async () => {
    if (!token) {
      setError('Token de acesso inválido');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const portalAccess = await getClientByToken(token);

      if (!portalAccess || !portalAccess.client) {
        setError('Acesso negado ou token inválido');
        setLoading(false);
        return;
      }

      const data = await getPortalData((portalAccess as any).client.id);

      setClient(data.client);
      setTasks(data.tasks);
      setMeetings(data.meetings);
      setError(null);
    } catch (err) {
      console.error('Error loading portal data:', err);
      setError('Erro ao carregar dados do portal');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">{error || 'Token de acesso inválido'}</p>
        </div>
      </div>
    );
  }

  const activeTasks = tasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada');
  const completedTasks = tasks.filter(t => t.status === 'concluida');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
                <p className="text-sm text-gray-600">Portal do Cliente</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Última atualização</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date().toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tarefas Ativas</p>
                <p className="text-3xl font-bold text-blue-600">{activeTasks.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tarefas Concluídas</p>
                <p className="text-3xl font-bold text-green-600">{completedTasks.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Reuniões Realizadas</p>
                <p className="text-3xl font-bold text-purple-600">{meetings.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tarefas Ativas</h2>
            {activeTasks.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
                <CheckCircle2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Nenhuma tarefa ativa no momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-700'}`}>
                        {task.priority}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
                        {TASK_STATUS_LABELS[task.status]}
                      </span>

                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Histórico de Reuniões</h2>
            {meetings.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Nenhuma reunião registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.slice(0, 10).map(meeting => (
                  <div
                    key={meeting.id}
                    className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">
                        {MEETING_TYPE_LABELS[meeting.type]}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(meeting.datetime).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {meeting.summary && (
                      <p className="text-sm text-gray-600 line-clamp-2">{meeting.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center">
          <p className="text-sm text-gray-600">
            Assistente Operacional W1 - Portal do Cliente
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Acompanhe seu progresso e mantenha-se atualizado
          </p>
        </div>
      </footer>
    </div>
  );
}
