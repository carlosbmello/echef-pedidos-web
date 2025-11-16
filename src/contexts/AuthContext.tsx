// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react'; // Adicionado useContext
import { User, AuthContextType } from '../types/auth'; // Certifique-se que esses tipos estão corretos
import { loginUser as apiLoginUser, getUserFromToken } from '../services/authService';
import apiClient from '../config/api';

// Exporta o Context diretamente se outros módulos precisarem dele (raro, mas possível)
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initializeAuth = useCallback(() => {
     const storedToken = localStorage.getItem('echef-token');
     if (storedToken) {
       try { // Adicionado try-catch para getUserFromToken
         const userData = getUserFromToken(storedToken);
         if (userData) {
           setToken(storedToken);
           setUser(userData);
           apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
         } else {
           localStorage.removeItem('echef-token');
           // Se getUserFromToken retorna null (ex: token expirado ou role errada), limpamos.
         }
       } catch (e) {
         console.error("Erro ao processar token armazenado:", e);
         localStorage.removeItem('echef-token'); // Limpa token inválido
       }
     }
     setIsLoading(false);
  }, []);


  useEffect(() => {
     initializeAuth();
  }, [initializeAuth]);

  const login = async (email: string, senhaVal: string) => {
    // Removido setIsLoading(true) daqui, pois será gerenciado pelo componente de Login
    // para feedback visual específico do formulário. O isLoading global é mais para a carga inicial.
    try {
      const { token: newToken } = await apiLoginUser(email, senhaVal);
      const userData = getUserFromToken(newToken);

      if (!userData) {
         throw new Error("Falha ao processar informações do usuário ou permissão negada.");
      }

      localStorage.setItem('echef-token', newToken);
      setToken(newToken);
      setUser(userData);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      // setIsLoading(false); // Não é mais necessário se não foi setado para true no início da função
    } catch (error) {
      // setIsLoading(false); // Não é mais necessário
      localStorage.removeItem('echef-token');
      setToken(null);
      setUser(null);
      delete apiClient.defaults.headers.common['Authorization'];
      console.error("Falha no login (AuthContext):", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('echef-token');
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common['Authorization'];
    // Considerar redirecionar para /login aqui ou no componente que chama logout
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user, // isAuthenticated é derivado de token e user
    isLoading, // isLoading é para a verificação inicial do token
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Renderiza children mesmo durante isLoading inicial, 
          os componentes protegidos (ProtectedRoute) que devem lidar com o estado de isLoading
          para decidir se renderizam um spinner ou redirecionam. */}
      {children}
    </AuthContext.Provider>
  );
};

// ---- ADICIONAR ESTA SEÇÃO ----
// Hook customizado para consumir o AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
// ---- FIM DA SEÇÃO ADICIONADA ----