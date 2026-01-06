import { useState } from 'react';
import { X, Copy, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '../lib/toast';

interface EmailPreviewModalProps {
  subject: string;
  htmlBody: string;
  onClose: () => void;
}

export default function EmailPreviewModal({ subject, htmlBody, onClose }: EmailPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopyHTML = async () => {
    try {
      await navigator.clipboard.writeText(htmlBody);
      setCopied(true);
      showToast('HTML copiado para a área de transferência', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast('Erro ao copiar HTML', 'error');
    }
  };

  const handleCopySubject = async () => {
    try {
      await navigator.clipboard.writeText(subject);
      showToast('Assunto copiado para a área de transferência', 'success');
    } catch (error) {
      showToast('Erro ao copiar assunto', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Pré-visualização do Email</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex items-center gap-4 px-6 py-3 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">Assunto:</span>
            <span className="text-sm text-gray-900 flex-1">{subject}</span>
            <button
              onClick={handleCopySubject}
              className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copiar
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-2 px-6 pt-3">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'preview'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Visualização
            </button>
            <button
              onClick={() => setActiveTab('html')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'html'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Código HTML
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'preview' ? (
            <div className="bg-white border border-gray-200 rounded-lg">
              <iframe
                srcDoc={htmlBody}
                className="w-full h-[500px] border-0"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
              <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap">
                {htmlBody}
              </pre>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            Copie o HTML e cole no seu cliente de email ou ferramenta de automação
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleCopyHTML}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar HTML
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
