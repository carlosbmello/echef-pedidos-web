// src/config/api.ts (VERSÃO DINÂMICA)
import axios from 'axios';

// --- LÓGICA DE URL DINÂMICA ---
// 1. Detecta onde o app está rodando (localhost ou IP)
const protocol = window.location.protocol; 
const hostname = window.location.hostname;
const port = '3010'; // Porta fixa do Backend

// 2. Monta a base
const dynamicBaseURL = `${protocol}//${hostname}:${port}/api`;

// 3. Adiciona o prefixo de Admin (Pedidos é admin)
const adminBaseUrl = `${dynamicBaseURL}/admin`;

console.log(`[API Pedidos] Conectando dinamicamente em: ${adminBaseUrl}`);

const apiClient = axios.create({
  baseURL: adminBaseUrl,
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