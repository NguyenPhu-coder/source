declare module "@/contexts/AuthContext" {
  export interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    bio?: string;
    phone?: string;
  }

  export interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<any>;
    logout: () => void;
    register: (name: string, email: string, password: string) => Promise<any>;
    updateUser?: (userData: Partial<User>) => Promise<any>;
  }

  export function useAuth(): AuthContextType;
}

declare module "@/contexts/LanguageContext" {
  export interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string) => string;
  }

  export function useLanguage(): LanguageContextType;
}

declare module "@/api/client" {
  const apiClient: any;
  export default apiClient;
}
