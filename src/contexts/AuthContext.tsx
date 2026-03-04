import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ak_trans_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // При монтировании — читаем сохранённого пользователя из localStorage
    // (наш auth — через Telegram ID + Edge Function, не через Supabase Auth)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Верифицируем что профиль ещё существует в Supabase
        supabase
          .from('profiles')
          .select('id, telegram_id, name, active')
          .eq('telegram_id', parsed.telegram_id)
          .eq('active', true)
          .single()
          .then(({ data, error }) => {
            if (error || !data) {
              // Профиль не найден или неактивен — выходим
              localStorage.removeItem(STORAGE_KEY);
              setUser(null);
            } else {
              // Профиль валиден — обновляем данные
              const updatedUser = { ...parsed, ...data };
              setUser(updatedUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
            }
            setIsLoading(false);
          });
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setIsLoading(false);
      }
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
