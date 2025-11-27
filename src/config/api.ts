// src/config/api.ts
import axios from 'axios';

// 1. Pega a URL base do ambiente (ex: http://localhost:3010/api)
const envBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api';

// 2. Adiciona o prefixo '/admin' para que todas as rotas usem o caminho correto
const apiClient = axios.create({
  baseURL: `${envBaseURL}/admin`,
});

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

export default apiClient;