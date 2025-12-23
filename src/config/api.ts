// src/config/api.ts (VERSÃO FINAL COM INTERCEPTOR ROBUSTO)
import axios from 'axios';

// 1. Pega a URL base do ambiente
const envBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api';

// 2. Adiciona o prefixo '/admin' para que todas as rotas usem o caminho correto
const apiClient = axios.create({
  baseURL: `${envBaseURL}/admin`,
  timeout: 10000, // Timeout de 10s para evitar travamentos
});

// --- 1. INTERCEPTOR DE REQUISIÇÃO ---
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('echef-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- 2. INTERCEPTOR DE RESPOSTA (NOVO: Trata o Erro 401) ---
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Se receber 401 (Não autorizado / Token expirado)
    if (error.response && error.response.status === 401) {
        console.warn("[API Pedidos] Sessão expirada. Redirecionando...");
        
        // Limpa dados de sessão (atuais e legados)
        localStorage.removeItem('echef-token');
        localStorage.removeItem('echef-user');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');

        // Redireciona para o login apenas se já não estivermos lá
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;