import { useState } from 'react';
import { X, MessageCircle, Send, FileText, Calendar } from 'lucide-react';
import { sendTasksSummary, sendMeetingSummary } from '../services/whatsappService';
import { useToast } from '../lib/toast';

interface WhatsAppModalProps {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  onClose: () => void;
}

export default function WhatsAppModal({
  clientId,
  clientName,
  clientPhone,
  onClose
}: WhatsAppModalProps) {
  const [phone, setPhone] = useState(clientPhone || '');
  const [messageType, setMessageType] = useState<'tasks' | 'meeting' | null>(null);
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();

  const handleSendTasksSummary = async () => {
    if (!phone) {
      showToast('Informe o número de telefone', 'error');
      return;
    }

    try {
      setSending(true);
      await sendTasksSummary(clientId, phone);
      showToast('Resumo de tarefas enviado com sucesso', 'success');
      onClose();
    } catch (error: any) {
      console.error('Error sending tasks summary:', error);
      showToast(error.message || 'Erro ao enviar resumo', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Enviar WhatsApp</h2>
              <p className="text-sm text-gray-600">{clientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Exemplo: 5511999999999 (código do país + DDD + número)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Mensagem
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setMessageType('tasks')}
                className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                  messageType === 'tasks'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Resumo de Tarefas</p>
                    <p className="text-sm text-gray-600">
                      Envia lista de tarefas pendentes com prazos
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {messageType && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Prévia da Mensagem</h4>
              <div className="text-sm text-gray-600 space-y-1">
                {messageType === 'tasks' && (
                  <>
                    <p>📋 <strong>Resumo de Tarefas - {clientName}</strong></p>
                    <p>Total de tarefas: <strong>X</strong></p>
                    <p className="text-xs italic mt-2">
                      + Lista detalhada de tarefas por status
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSendTasksSummary}
            disabled={!phone || !messageType || sending}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
