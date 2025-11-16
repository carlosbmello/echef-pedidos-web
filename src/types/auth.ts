// src/types/auth.ts
export interface User {
  id: number;
  nome?: string; // Já era opcional
  login?: string; // <-- Tornar opcional
  role: 'admin' | 'caixa' | 'garcom' | 'recepcao';
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<void>; // Parâmetro agora é email
  logout: () => void;
}

// Não precisamos mais exportar DecodedJwtPayload daqui se não for usada estritamente
// export interface DecodedJwtPayload { ... }