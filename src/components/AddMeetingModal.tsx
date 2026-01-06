import { useState, useEffect } from 'react';
import { X, Loader2, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import { addMeeting, summarizeMeeting } from '../services/meetingService';
import { createTasks } from '../services/taskService';
import { draftEmail } from '../services/emailService';
import { getActiveMeetingTypes, type MeetingTypeDetails } from '../services/meetingTypeService';
import { useToast } from '../lib/toast';
import type { MeetingType } from '../lib/database.types';

interface AddMeetingModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMeetingModal({ clientId, clientName, onClose, onSuccess }: AddMeetingModalProps) {
  const [step, setStep] = useState<'form' | 'summary' | 'email'>('form');
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeDetails[]>([]);
  const [meetingType, setMeetingType] = useState<MeetingType>('');
  const [datetime, setDatetime] = useState('');
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [emailDraft, setEmailDraft] = useState<any>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  const loadMeetingTypes = async () => {
    try {
      const types = await getActiveMeetingTypes();
      setMeetingTypes(types);
      if (types.length > 0 && !meetingType) {
        setMeetingType(types[0].code);
      }
    } catch (error) {
      console.error('Error loading meeting types:', error);
      showToast('Erro ao carregar tipos de reunião', 'error');
    }
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Calendar;
    return <IconComponent className="w-4 h-4" />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datetime || !transcript.trim()) return;

    setLoading(true);
    try {
      const meeting = await addMeeting({
        client_id: clientId,
        type: meetingType,
        datetime: new Date(datetime).toISOString(),
        transcript_text: transcript.trim()
      });

      setMeetingId(meeting.id);

      const summaryResult = await summarizeMeeting(meeting.id);
      setSummary(summaryResult);

      setStep('summary');
    } catch (error: any) {
      console.error('Error processing meeting:', error);
      const errorMessage = error?.message || 'Erro desconhecido ao processar reunião';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTasks = async () => {
    if (!summary?.suggested_tasks || !meetingId) return;

    setLoading(true);
    try {
      await createTasks(
        summary.suggested_tasks.map((task: any) => ({
          client_id: clientId,
          meeting_id: meetingId,
          title: task.title,
          description: task.description,
          owner: task.owner,
          due_date: task.due_date
        }))
      );

      const draft = await draftEmail({ meeting_id: meetingId });
      setEmailDraft(draft);
      setStep('email');
    } catch (error) {
      console.error('Error creating tasks:', error);
      showToast('Erro ao criar tarefas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyEmail = () => {
    if (emailDraft?.html_body) {
      navigator.clipboard.writeText(emailDraft.html_body);
      showToast('E-mail copiado para área de transferência', 'success');
    }
  };

  const handleFinish = () => {
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'form' && 'Registrar Reunião'}
              {step === 'summary' && 'Resumo da Reunião'}
              {step === 'email' && 'Rascunho de E-mail'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Reunião
                </label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {meetingTypes.map((type) => (
                    <option key={type.id} value={type.code}>
                      {type.code} - {type.display_name}
                    </option>
                  ))}
                </select>
                {meetingTypes.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">Nenhum tipo de reunião disponível</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora
                </label>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transcrição da Reunião
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Cole ou digite a transcrição da reunião aqui..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={12}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cole o conteúdo do arquivo .txt da transcrição
                </p>
              </div>

              <div className="flex gap-3 pt-4">
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={loading || !datetime || !transcript.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Processar Reunião'
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 'summary' && summary && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Resumo</h3>
                <ul className="space-y-1 bg-gray-50 rounded-lg p-4">
                  {summary.summary.map((item: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Decisões</h3>
                <ul className="space-y-1 bg-gray-50 rounded-lg p-4">
                  {summary.decisions.map((item: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start">
                      <input type="checkbox" className="mr-2 mt-0.5" disabled />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Tarefas Sugeridas</h3>
                <div className="space-y-2">
                  {summary.suggested_tasks.map((task: any, i: number) => (
                    <div key={i} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                        <span className="font-medium">{task.owner}</span>
                        <span>• {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {summary.risk_signals && summary.risk_signals !== 'Nenhum sinal identificado' && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Sinais de Risco</h3>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-sm text-gray-700">{summary.risk_signals}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleFinish}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Concluir Sem Tarefas
                </button>
                <button
                  onClick={handleCreateTasks}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Tarefas e Gerar E-mail'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'email' && emailDraft && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assunto
                </label>
                <input
                  type="text"
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corpo do E-mail (HTML)
                </label>
                <textarea
                  value={emailDraft.html_body}
                  onChange={(e) => setEmailDraft({ ...emailDraft, html_body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  rows={15}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preview
                </label>
                <div
                  className="border border-gray-300 rounded-lg p-4 bg-white max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: emailDraft.html_body }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleFinish}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Concluir
                </button>
                <button
                  onClick={handleCopyEmail}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copiar HTML
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
