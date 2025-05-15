// src/services/authService.ts
import apiClient from '../config/api';
// import { User, DecodedJwtPayload } from '../types/auth'; // Remover DecodedJwtPayload se não usada
import { User } from '../types/auth'; // Apenas User
import { jwtDecode } from 'jwt-decode';

interface LoginResponse {
  token: string;
  // Poderíamos fazer o backend retornar o user aqui, mas vamos focar no token por enquanto
}

// Função loginUser já foi ajustada para enviar 'email'
export const loginUser = async (email: string, senha: string): Promise<{ token: string }> => {
  const response = await apiClient.post<LoginResponse>('/auth/login', { email, senha });
  return { token: response.data.token };
};

// Ajustar getUserFromToken
export const getUserFromToken = (token: string): User | null => {
  try {
    // Decodificar para 'any' ou uma interface mínima que só tenha o que esperamos encontrar
    const decoded = jwtDecode<any>(token);

    // Validação mínima - AGORA SÓ POR userId e role
    if (!decoded.userId || !decoded.role) {
      console.error("Token decodificado não contém userId ou role:", decoded);
      return null;
    }

    // Garante que apenas garçons ou admins possam usar este app
    if (decoded.role !== 'garcom' && decoded.role !== 'admin') {
        console.warn(`Usuário com role '${decoded.role}' tentou logar no app de pedidos.`);
        return null;
    }

    // Retorna o objeto User APENAS com os dados disponíveis no token
    return {
      id: decoded.userId,
      // nome: undefined, // nome não está no token
      // login: undefined, // login não está no token
      role: decoded.role,
    };
  } catch (error) {
    console.error("Falha ao decodificar o token:", error);
    return null;
  }
};