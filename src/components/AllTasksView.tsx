import { useEffect, useState } from 'react';
import { CheckCircle2, Edit2, Trash2, AlertCircle, Save, X, ArrowLeft, User, LayoutGrid, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAllTasks, updateTaskStatus } from '../services/taskService';
import { useToast } from '../lib/toast';
import type { Database } from '../lib/database.types';
import KanbanBoard from './KanbanBoard';

type Task = Database['public']['Tables']['tasks']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface TaskWithClient extends Task {
  client: Client;
}

interface AllTasksViewProps {
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onClearClient: () => void;
}

type ViewMode = 'list' | 'kanban';

export default function AllTasksView({ selectedClientId, onSelectClient, onClearClient }: AllTasksViewProps) {
  const [tasks, setTasks] = useState<TaskWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pendente' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadTasks();
  }, [filter, selectedClientId]);

  useEffect(() => {
    if (selectedClientId) {
      loadSelectedClient();
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId]);

  const loadSelectedClient = async () => {
    if (!selectedClientId) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', selectedClientId)
        .single();

      if (error) throw error;
      setSelectedClient(data);
    } catch (error) {
      console.error('Error loading client:', error);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const allTasks = await getAllTasks();
      let filteredTasks = allTasks;

      if (selectedClientId) {
        filteredTasks = allTasks.filter(task => task.client_id === selectedClientId);
      }

      if (filter === 'pendente') {
        filteredTasks = filteredTasks.filter(task =>
          task.status === 'pendente' || task.status === 'em_andamento'
        );
      } else if (filter === 'overdue') {
        const today = new Date().toISOString().split('T')[0];
        filteredTasks = filteredTasks.filter(task =>
          (task.status === 'pendente' || task.status === 'em_andamento') &&
          task.due_date < today
        );
      }

      setTasks((filteredTasks as any) || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      showToast('Erro ao carregar tarefas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
      await updateTaskStatus(taskId, newStatus as any);
      loadTasks();
      showToast('Status atualizado', 'success');
    } catch (error) {
      showToast('Erro ao atualizar tarefa', 'error');
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task.id);
    setEditForm(task);
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editForm.title,
          description: editForm.description,
          due_date: editForm.due_date
        })
        .eq('id', editingTask);

      if (error) throw error;

      setEditingTask(null);
      loadTasks();
      showToast('Tarefa atualizada', 'success');
    } catch (error) {
      showToast('Erro ao salvar alterações', 'error');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      loadTasks();
      showToast('Tarefa excluída', 'success');
    } catch (error) {
      showToast('Erro ao excluir tarefa', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'concluida') return false;
    return new Date(dueDate) < new Date();
  };

  if (viewMode === 'kanban') {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {selectedClient ? (
                <div>
                  <button
                    onClick={onClearClient}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para todas as tarefas
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedClient.name}</h2>
                      <p className="text-sm text-gray-500">Tarefas do cliente</p>
                    </div>
                  </div>
                </div>
              ) : (
                <h2 className="text-xl font-semibold text-gray-900">Todas as Tarefas</h2>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <List className="w-4 h-4" />
                Lista
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <KanbanBoard selectedClientId={selectedClientId} onSelectClient={onSelectClient} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            {selectedClient ? (
              <div>
                <button
                  onClick={onClearClient}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para todas as tarefas
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedClient.name}</h2>
                    <p className="text-sm text-gray-500">Tarefas do cliente</p>
                  </div>
                </div>
              </div>
            ) : (
              <h2 className="text-xl font-semibold text-gray-900">Todas as Tarefas</h2>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List className="w-4 h-4" />
              Lista
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('pendente')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === 'pendente'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === 'overdue'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Vencidas
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            Nenhuma tarefa encontrada
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const overdue = isOverdue(task.due_date, task.status);
              const isEditing = editingTask === task.id;

              return (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 ${
                    overdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Título"
                      />
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        rows={3}
                        placeholder="Descrição"
                      />
                      <div className="flex gap-3">
                        <input
                          type="date"
                          value={editForm.due_date}
                          onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                          className="px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Save className="w-4 h-4" />
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingTask(null)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={task.status === 'concluida'}
                            onChange={() => handleToggleTask(task.id, task.status)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              {!selectedClientId && (
                                <>
                                  <button
                                    onClick={() => onSelectClient(task.client_id)}
                                    className="font-medium text-blue-600 hover:text-blue-800 transition-colors"
                                  >
                                    {task.client.name}
                                  </button>
                                  <span>•</span>
                                </>
                              )}
                              <span className="font-medium">{task.owner}</span>
                              <span>•</span>
                              <span>{formatDate(task.due_date)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {overdue && (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                          <button
                            onClick={() => handleEdit(task)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
