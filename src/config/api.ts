// src/config/api.ts (VERSÃO HÍBRIDA NUVEM/LOCAL)
import axios from 'axios';

const getBaseURL = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // 1. VERIFICA SE ESTÁ NO AMBIENTE LOCAL (Mini PC ou Rede Local)
    const isLocal = 
        hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') || 
        hostname.endsWith('.local');

    if (isLocal) {
        // No local, batemos direto na porta 3010 para suportar modo offline
        return `${protocol}//${hostname}:3010/api/admin`;
    }

    // 2. AMBIENTE DE NUVEM (PRODUÇÃO)
    // Na nuvem, usamos o subdomínio da API central sem a porta 3010
    return `https://api.neverlandbar.com.br/api/admin`;
};

const API_BASE_URL = getBaseURL();

console.log(`[API Pedidos] Conectando em: ${API_BASE_URL}`);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// --- Interceptor de Requisição ---
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

// --- Interceptor de Resposta (401) ---
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
        console.warn("[API Pedidos] Sessão expirada. Redirecionando...");
        localStorage.removeItem('echef-token');
        localStorage.removeItem('echef-user');
        
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
        }
    }
    return Promise.reject(error);
  }
);

export default apiClient;