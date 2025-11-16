// src/pages/LoginPage.tsx
import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom'; // Adicionado Link se houver links como "Esqueci senha"
import { useAuth } from '../contexts/AuthContext'; // Ou o caminho correto para seu AuthContext
import { FiLogIn, FiUser, FiLock } from 'react-icons/fi';
import { toast } from 'react-toastify';
// Supondo que você tem um logo ou quer exibir o nome do app
// import logoImage from '../assets/logo.png'; // Exemplo

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !password) {
      setError("Por favor, preencha e-mail e senha.");
      setIsLoading(false);
      return;
    }

    try {
      console.log("[LoginPage] Tentando login com:", { email });
      await login(email, password);
      console.log("[LoginPage] Login bem-sucedido.");
      toast.success("Login realizado com sucesso!");
      // O ProtectedRoute cuidará do redirecionamento se a navegação for para uma rota protegida
      // Mas um redirecionamento explícito para a página principal após o login é comum.
      // Ajuste '/comandas' para a rota principal do seu app de pedidos ou caixa.
      navigate('/comandas', { replace: true }); 
    } catch (err: any) {
      console.error("[LoginPage] Erro no login:", err);
      const errorMessage = err.response?.data?.message || err.message || "Falha no login. Verifique suas credenciais.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
        <div>
          {/* Exemplo de Logo/Título */}
          {/* <img className="mx-auto h-12 w-auto" src={logoImage} alt="eChef Logo" /> */}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            eChef Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Acesse sua conta para continuar
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md">
              <p>{error}</p>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-3 pl-10 border border-gray-300 
                         placeholder-gray-500 text-gray-900 bg-white {/* <--- ADICIONADO/GARANTIDO bg-white */}
                         rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Endereço de e-mail"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password_login" className="sr-only"> {/* Alterado id para evitar conflito se houver outro campo password */}
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="password_login" // Alterado id
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // ***** CLASSES DO TAILWIND PARA COR DO TEXTO E PLACEHOLDER *****
                  className="appearance-none rounded-none relative block w-full px-3 py-3 pl-10 border border-gray-300 
                         placeholder-gray-500 text-gray-900 bg-white {/* <--- ADICIONADO/GARANTIDO bg-white */}
                         rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Senha"
                />
              </div>
            </div>
          </div>

          {/* Opcional: Links como "Esqueci minha senha" 
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link to="/esqueci-senha" className="font-medium text-indigo-600 hover:text-indigo-500">
                Esqueceu sua senha?
              </Link>
            </div>
          </div>
          */}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <FiLogIn className="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" aria-hidden="true" />
                </span>
              )}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;