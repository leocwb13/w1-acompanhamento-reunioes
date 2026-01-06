import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { sendChatMessage, getConversationHistory, type ChatMessage } from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../lib/toast';

interface ChatInterfaceProps {
  selectedClientId: string | null;
  onRefresh: () => void;
}

export default function ChatInterface({ selectedClientId, onRefresh }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, subscription } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (selectedClientId) {
      loadHistory();
    } else {
      setMessages([]);
    }
  }, [selectedClientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    if (!selectedClientId) return;
    setLoadingHistory(true);
    try {
      const history = await getConversationHistory(selectedClientId, 20);
      setMessages(history);
    } catch (error: any) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !user || loading) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { response } = await sendChatMessage(
        user.id,
        selectedClientId,
        userMessage.content,
        messages
      );

      const assistantMessage: ChatMessage = {
        id: `response-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      onRefresh();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao enviar mensagem', 'error');
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const creditsRemaining = subscription?.plan?.credits_per_month
    ? (subscription.plan.credits_per_month - (subscription.credits_used || 0))
    : null;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-6">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-600">Carregando histórico...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedClientId
                  ? 'Inicie uma conversa'
                  : 'Selecione um cliente'}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {selectedClientId
                  ? 'Faça perguntas sobre este cliente ou solicite análises e insights.'
                  : 'Escolha um cliente na lista à esquerda para começar'}
              </p>

              {selectedClientId && creditsRemaining !== null && (
                <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>{creditsRemaining}</strong> {creditsRemaining === 1 ? 'crédito disponível' : 'créditos disponíveis'}
                  </p>
                </div>
              )}

              {selectedClientId && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700 mb-3">Sugestões de perguntas:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => setInput('Qual o status atual deste cliente?')}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Status do cliente
                    </button>
                    <button
                      onClick={() => setInput('Quais são as tarefas pendentes?')}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Tarefas pendentes
                    </button>
                    <button
                      onClick={() => setInput('Resumo das últimas reuniões')}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Últimas reuniões
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              selectedClientId
                ? 'Digite sua mensagem...'
                : 'Selecione um cliente primeiro'
            }
            disabled={!selectedClientId || loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!selectedClientId || !input.trim() || loading}
            className="px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
