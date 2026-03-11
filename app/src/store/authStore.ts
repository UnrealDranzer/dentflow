import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Clinic {
  clinic_id: number;
  clinic_name: string;
  email: string;
  phone: string;
  subscription_plan: string;
  subscription_status: string;
}

interface AuthState {
  clinic: Clinic | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (clinic: Clinic, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateClinic: (clinic: Partial<Clinic>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      clinic: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (clinic, token) => set({
        clinic,
        token,
        isAuthenticated: true,
        isLoading: false
      }),

      logout: () => set({
        clinic: null,
        token: null,
        isAuthenticated: false,
        isLoading: false
      }),

      setLoading: (loading) => set({ isLoading: loading }),

      updateClinic: (updates) => set((state) => ({
        clinic: state.clinic ? { ...state.clinic, ...updates } : null
      }))
    }),
    {
      name: 'dentflow-auth',
      partialize: (state) => ({ 
        clinic: state.clinic, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      })
    }
  )
);
