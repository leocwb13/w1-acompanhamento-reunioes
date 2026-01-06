import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';

type AuthView = 'login' | 'signup' | 'forgot-password';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'signup') {
      return <SignUpPage onLoginClick={() => setAuthView('login')} />;
    }

    if (authView === 'forgot-password') {
      return <ForgotPasswordPage onBackClick={() => setAuthView('login')} />;
    }

    return (
      <LoginPage
        onSignUpClick={() => setAuthView('signup')}
        onForgotPasswordClick={() => setAuthView('forgot-password')}
      />
    );
  }

  return <>{children}</>;
}
