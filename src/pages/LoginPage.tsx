// src/pages/LoginPage.tsx
import React, { useState, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { FiLogIn } from 'react-icons/fi'; // Exemplo de ícone

const LoginPage: React.FC = () => {
  const [loginField, setLoginField] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/comandas"; // Redireciona para comandas por padrão

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(loginField, senha);
      // Navegação é tratada abaixo ou pelo ProtectedRoute
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Falha no login. Verifique suas credenciais ou permissões.';
      setError(errorMessage);
    }
  };

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-700">
            eChef <span className="text-blue-600">Pedidos</span>
          </h1>
          <p className="text-slate-500">Acesso do Garçom</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
             <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md" role="alert">
                 <p className="font-bold">Erro</p>
                 <p>{error}</p>
             </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="login">
              Usuário
            </label>
            <input
              type="text"
              id="login"
              value={loginField}
              onChange={(e) => setLoginField(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={authIsLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiLogIn className="mr-2 h-5 w-5" />
              {authIsLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
      <footer className="mt-8 text-center text-sm text-slate-400">
         <p>© {new Date().getFullYear()} eChef. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LoginPage;