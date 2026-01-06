import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, CheckCircle2, AlertCircle, Plus, Trash2, Download, Database, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import { getClient, deleteClient, type ClientWithMetrics } from '../services/clientService';
import { calculateRiskScore, type RiskScoreBreakdown } from '../services/riskService';
import { updateTaskStatus } from '../services/taskService';
import { exportCompleteClientData, downloadJSON, copyToClipboard } from '../services/exportService';
import { getAllMeetingTypes, type MeetingTypeDetails } from '../services/meetingTypeService';
import AddMeetingModal from './AddMeetingModal';
import ClientMetadataEditor from './ClientMetadataEditor';
import { useToast } from '../lib/toast';

interface ClientPanelProps {
  clientId: string;
  onRefresh: () => void;
  onClientDeleted?: () => void;
}

export default function ClientPanel({ clientId, onRefresh, onClientDeleted }: ClientPanelProps) {
  const [client, setClient] = useState<ClientWithMetrics | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<Record<string, MeetingTypeDetails>>({});
  const [riskBreakdown, setRiskBreakdown] = useState<RiskScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [calculatingRisk, setCalculatingRisk] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadMeetingTypes();
    loadClientData();
  }, [clientId]);

  const loadMeetingTypes = async () => {
    try {
      const types = await getAllMeetingTypes();
      const typesMap = types.reduce((acc, type) => {
        acc[type.code] = type;
        return acc;
      }, {} as Record<string, MeetingTypeDetails>);
      setMeetingTypes(typesMap);
    } catch (error) {
      console.error('Error loading meeting types:', error);
    }
  };

  const getMeetingTypeLabel = (code: string): string => {
    return meetingTypes[code]?.display_name || code;
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Calendar;
    return <IconComponent className="w-4 h-4" />;
  };

  const loadClientData = async () => {
    setLoading(true);
    try {
      const data = await getClient({ id: clientId });
      setClient(data);
    } catch (error) {
      console.error('Error loading client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateRisk = async () => {
    setCalculatingRisk(true);
    try {
      const breakdown = await calculateRiskScore(clientId);
      setRiskBreakdown(breakdown);
      await loadClientData();
      onRefresh();
    } catch (error) {
      console.error('Error calculating risk:', error);
    } finally {
      setCalculatingRisk(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
      await updateTaskStatus(taskId, newStatus as any);
      await loadClientData();
      onRefresh();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteClient = async () => {
    if (confirmName !== client?.name) {
      showToast('O nome do cliente não corresponde', 'error');
      return;
    }

    setDeletingClient(true);
    try {
      await deleteClient(clientId);
      showToast('Cliente excluído com sucesso', 'success');
      setShowDeleteModal(false);
      if (onClientDeleted) {
        onClientDeleted();
      }
    } catch (error: any) {
      console.error('Error deleting client:', error);
      showToast(error?.message || 'Erro ao excluir cliente', 'error');
    } finally {
      setDeletingClient(false);
    }
  };

  const handleExportData = async (format: 'download' | 'copy') => {
    setExporting(true);
    try {
      const exportData = await exportCompleteClientData(clientId);

      if (format === 'download') {
        const filename = `${client?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        downloadJSON(exportData, filename);
        showToast('Dados exportados com sucesso', 'success');
      } else {
        await copyToClipboard(exportData);
        showToast('Dados copiados para a área de transferência', 'success');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      showToast('Erro ao exportar dados', 'error');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <aside className="w-96 bg-white border-l border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </aside>
    );
  }

  if (!client) return null;

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <aside className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
        <h2 className="font-semibold text-gray-900 text-lg mb-1">{client.name}</h2>
        {client.email && (
          <p className="text-sm text-gray-600">{client.email}</p>
        )}
        {client.phone && (
          <p className="text-sm text-gray-600">{client.phone}</p>
        )}

        <div className="space-y-2 mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddMeeting(true)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Reunião
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center"
              title="Excluir Cliente"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowMetadataEditor(true)}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Database className="w-4 h-4" />
              Dados Completos
            </button>
            <button
              onClick={() => handleExportData('download')}
              disabled={exporting}
              className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:bg-green-50 transition-colors flex items-center justify-center gap-2 text-sm"
              title="Exportar JSON"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exportando...' : 'Exportar'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Risk Score</h3>
            <button
              onClick={handleCalculateRisk}
              disabled={calculatingRisk}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {calculatingRisk ? 'Calculando...' : 'Recalcular'}
            </button>
          </div>

          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getRiskColor(client.risk_score)}`}
                  style={{ width: `${client.risk_score}%` }}
                />
              </div>
            </div>
            <span className={`text-2xl font-bold ${getRiskColor(client.risk_score)}`}>
              {client.risk_score}
            </span>
          </div>

          {riskBreakdown && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Classificação: {riskBreakdown.classification}
              </p>
              {riskBreakdown.factors.map((factor, i) => (
                <div key={i} className="text-xs text-gray-600">
                  <span className={factor.impact > 0 ? 'text-red-600' : 'text-green-600'}>
                    {factor.impact > 0 ? '+' : ''}{factor.impact}
                  </span>
                  {' '}{factor.factor}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Métricas</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">
                {client.recent_meetings.length}
              </div>
              <div className="text-xs text-gray-600">Reuniões</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">
                {client.pending_tasks.length}
              </div>
              <div className="text-xs text-gray-600">Tarefas Pendentes</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">
                {client.days_since_last_advance ?? '-'}
              </div>
              <div className="text-xs text-gray-600">Dias Sem Avanço</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">
                {client.completed_tasks_last_week}
              </div>
              <div className="text-xs text-gray-600">Concluídas 7d</div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Últimas Reuniões
          </h3>
          {client.recent_meetings.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma reunião registrada</p>
          ) : (
            <div className="space-y-2">
              {client.recent_meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-medium inline-flex items-center gap-1"
                      style={{ color: meetingTypes[meeting.type]?.color || '#3B82F6' }}
                    >
                      {meetingTypes[meeting.type] && renderIcon(meetingTypes[meeting.type].icon)}
                      {getMeetingTypeLabel(meeting.type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(meeting.datetime)}
                    </span>
                  </div>
                  {meeting.summary && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {meeting.summary.split('\n')[0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Tarefas Pendentes
          </h3>
          {client.pending_tasks.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma tarefa pendente</p>
          ) : (
            <div className="space-y-2">
              {client.pending_tasks.map((task) => {
                const isOverdue = new Date(task.due_date) < new Date();
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-2 p-2 rounded-lg border ${
                      isOverdue ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={task.status === 'concluida'}
                      onChange={() => handleToggleTask(task.id, task.status)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                        <span className="font-medium">{task.owner}</span>
                        <span>• {formatDate(task.due_date)}</span>
                      </div>
                    </div>
                    {isOverdue && (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddMeeting && (
        <AddMeetingModal
          clientId={clientId}
          clientName={client.name}
          onClose={() => setShowAddMeeting(false)}
          onSuccess={() => {
            setShowAddMeeting(false);
            loadClientData();
            onRefresh();
          }}
        />
      )}

      {showMetadataEditor && (
        <ClientMetadataEditor
          clientId={clientId}
          clientName={client.name}
          onClose={() => setShowMetadataEditor(false)}
          onSaved={() => {
            loadClientData();
            onRefresh();
          }}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Excluir Cliente</h3>
            </div>

            <div className="mb-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-900 font-medium mb-2">
                  Atenção! Esta ação não pode ser desfeita.
                </p>
                <p className="text-sm text-red-800">
                  Ao excluir o cliente <strong>{client.name}</strong>, você também perderá:
                </p>
                <ul className="text-sm text-red-800 list-disc list-inside mt-2 space-y-1">
                  <li>Todas as reuniões ({client.recent_meetings.length} registradas)</li>
                  <li>Todas as tarefas ({client.pending_tasks.length} pendentes)</li>
                  <li>Todo o histórico e métricas</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Digite o nome do cliente para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={client.name}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmName('');
                }}
                disabled={deletingClient}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deletingClient || confirmName !== client.name}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingClient ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir Cliente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
