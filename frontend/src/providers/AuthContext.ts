import { createContext } from 'react';

export interface AuthContextType {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'EMPLOYER' | 'EMPLOYEE';
    picture?: string;
  } | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: 'google' | 'github') => void;
  logout: () => void;
  setTokenFromCallback: (token: string, refreshToken?: string | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
