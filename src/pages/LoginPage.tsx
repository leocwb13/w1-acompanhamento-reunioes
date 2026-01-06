import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { signIn } from '../services/authService';
import { useToast } from '../lib/toast';

interface LoginPageProps {
  onSignUpClick: () => void;
  onForgotPasswordClick: () => void;
}

export default function LoginPage({ onSignUpClick, onForgotPasswordClick }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      showToast('Preencha todos os campos', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn({ email, password });

      if (error) {
        showToast(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message, 'error');
      } else {
        showToast('Login realizado com sucesso!', 'success');
      }
    } catch (error) {
      showToast('Erro ao fazer login. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assistente W1</h1>
          <p className="text-gray-600">Clareza, Continuidade e Controle de Clientes</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-2 mb-6">
            <LogIn className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Entrar na sua conta</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-blue-600 hover:text-blue-700"
                disabled={loading}
              >
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <button
                onClick={onSignUpClick}
                className="text-blue-600 hover:text-blue-700 font-medium"
                disabled={loading}
              >
                Criar conta gratuita
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
