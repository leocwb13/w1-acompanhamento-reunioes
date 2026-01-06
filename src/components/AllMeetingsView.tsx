import { useEffect, useState } from 'react';
import { Calendar, Eye, Trash2, Mail, ArrowLeft, User, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import * as Icons from 'lucide-react';
import { getAllMeetings, deleteMeeting } from '../services/meetingService';
import { draftEmail } from '../services/emailService';
import { getAllMeetingTypes, type MeetingTypeDetails } from '../services/meetingTypeService';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import EmailPreviewModal from './EmailPreviewModal';

type Meeting = Database['public']['Tables']['meetings']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface MeetingWithClient extends Meeting {
  client: Client;
}

interface AllMeetingsViewProps {
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onClearClient: () => void;
}

export default function AllMeetingsView({ selectedClientId, onSelectClient, onClearClient }: AllMeetingsViewProps) {
  const [meetings, setMeetings] = useState<MeetingWithClient[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<Record<string, MeetingTypeDetails>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithClient | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html_body: string } | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadMeetingTypes();
    loadMeetings();
  }, [selectedClientId]);

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

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const data = await getAllMeetings();
      let filteredMeetings = data;

      if (selectedClientId) {
        filteredMeetings = data.filter(meeting => meeting.client_id === selectedClientId);
      }

      setMeetings((filteredMeetings as any) || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
      showToast('Erro ao carregar reuniões', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  const handleDeleteMeeting = async (meetingId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!confirm('Tem certeza que deseja excluir esta reunião? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await deleteMeeting(meetingId);
      showToast('Reunião excluída com sucesso', 'success');

      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting(null);
      }

      await loadMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      showToast('Erro ao excluir reunião', 'error');
    }
  };

  const handleGenerateEmail = async () => {
    if (!selectedMeeting) return;

    setGeneratingEmail(true);
    try {
      const email = await draftEmail({ meeting_id: selectedMeeting.id });
      setEmailPreview(email);
      showToast('Email gerado com sucesso', 'success');
    } catch (error) {
      console.error('Error generating email:', error);
      showToast('Erro ao gerar email', 'error');
    } finally {
      setGeneratingEmail(false);
    }
  };

  return (
    <div className="h-full flex bg-white">
      <div className="flex-1 flex flex-col border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          {selectedClient ? (
            <div>
              <button
                onClick={onClearClient}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para todas as reuniões
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedClient.name}</h2>
                  <p className="text-sm text-gray-500">Reuniões do cliente</p>
                </div>
              </div>
            </div>
          ) : (
            <h2 className="text-xl font-semibold text-gray-900">Todas as Reuniões</h2>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              Nenhuma reunião registrada
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => {
                const decisionsCount = meeting.decisions ? (Array.isArray(meeting.decisions) ? meeting.decisions.length : 0) : 0;
                const hasRiskSignals = meeting.risk_signals && meeting.risk_signals !== 'Nenhum sinal identificado';
                const summaryPreview = meeting.summary ? meeting.summary.split('\n').slice(0, 2).join(' ').substring(0, 150) : '';

                return (
                  <div
                    key={meeting.id}
                    className={`relative border rounded-lg transition-all duration-200 ${
                      selectedMeeting?.id === meeting.id
                        ? 'bg-blue-50 border-blue-300 shadow-md'
                        : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedMeeting(meeting)}
                      className="w-full text-left p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          {!selectedClientId ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectClient(meeting.client_id);
                              }}
                              className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-base"
                            >
                              {meeting.client.name}
                            </button>
                          ) : (
                            <h3 className="font-semibold text-gray-900 text-base">{meeting.client.name}</h3>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: meetingTypes[meeting.type]?.color + '20' || '#3B82F620',
                                color: meetingTypes[meeting.type]?.color || '#3B82F6'
                              }}
                            >
                              {meetingTypes[meeting.type] && renderIcon(meetingTypes[meeting.type].icon)}
                              {getMeetingTypeLabel(meeting.type)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <Calendar className="w-4 h-4" />
                        {formatDateTime(meeting.datetime)}
                      </div>

                      {summaryPreview && (
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {summaryPreview}
                            {meeting.summary && meeting.summary.length > 150 && '...'}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {decisionsCount > 0 && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-gray-700 font-medium">{decisionsCount}</span>
                            <span className="text-gray-500">decisões</span>
                          </div>
                        )}

                        {meeting.transcript_text && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-gray-500">Transcrição</span>
                          </div>
                        )}

                        {hasRiskSignals && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span className="text-amber-700 font-medium">Sinais de risco</span>
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                      className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir reunião"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedMeeting && (
        <div className="w-1/2 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{selectedMeeting.client.name}</h3>
                <p className="text-sm mt-1 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: meetingTypes[selectedMeeting.type]?.color + '20' || '#3B82F620',
                      color: meetingTypes[selectedMeeting.type]?.color || '#3B82F6'
                    }}
                  >
                    {meetingTypes[selectedMeeting.type] && renderIcon(meetingTypes[selectedMeeting.type].icon)}
                    {getMeetingTypeLabel(selectedMeeting.type)}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-600">{formatDateTime(selectedMeeting.datetime)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateEmail}
                  disabled={generatingEmail}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
                  title="Gerar email"
                >
                  <Mail className="w-4 h-4" />
                  {generatingEmail ? 'Gerando...' : 'Gerar Email'}
                </button>
                <button
                  onClick={() => handleDeleteMeeting(selectedMeeting.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir reunião"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedMeeting.summary && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Resumo</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-1">
                    {selectedMeeting.summary.split('\n').filter(l => l.trim()).map((line, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start">
                        <span className="mr-2">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {selectedMeeting.decisions && Array.isArray(selectedMeeting.decisions) && selectedMeeting.decisions.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Decisões</h4>
                <div className="bg-blue-50 rounded-lg p-4">
                  <ul className="space-y-2">
                    {selectedMeeting.decisions.map((decision: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start">
                        <input type="checkbox" className="mr-2 mt-0.5" disabled />
                        <span>{decision}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {selectedMeeting.risk_signals && selectedMeeting.risk_signals !== 'Nenhum sinal identificado' && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Sinais de Risco</h4>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-sm text-gray-700">{selectedMeeting.risk_signals}</p>
                </div>
              </div>
            )}

            {selectedMeeting.transcript_text && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Transcrição</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {selectedMeeting.transcript_text}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {emailPreview && (
        <EmailPreviewModal
          subject={emailPreview.subject}
          htmlBody={emailPreview.html_body}
          onClose={() => setEmailPreview(null)}
        />
      )}
    </div>
  );
}
