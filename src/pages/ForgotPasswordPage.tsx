import { useState } from 'react';
import { KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import { resetPassword } from '../services/authService';
import { useToast } from '../lib/toast';

interface ForgotPasswordPageProps {
  onBackClick: () => void;
}

export default function ForgotPasswordPage({ onBackClick }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      showToast('Digite seu email', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword(email);

      if (error) {
        showToast(error.message, 'error');
      } else {
        setSent(true);
        showToast('Email de recuperação enviado!', 'success');
      }
    } catch (error) {
      showToast('Erro ao enviar email. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assistente W1</h1>
          <p className="text-gray-600">Recupere o acesso à sua conta</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-2 mb-6">
            <KeyRound className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Recuperar senha</h2>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  Email enviado com sucesso! Verifique sua caixa de entrada e siga as instruções
                  para redefinir sua senha.
                </p>
              </div>

              <button
                onClick={onBackClick}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar ao login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email cadastrado
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enviaremos um link para redefinir sua senha
                </p>
              </div>

              <button
                type="submit"
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    Enviar link de recuperação
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBackClick}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
