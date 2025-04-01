import { create } from 'zustand'
import { supabase } from '../lib/supabase/client'
import { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true })
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        set({ 
          session, 
          user: session.user,
          isAuthenticated: true,
          error: null,
        })
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ error: 'Failed to initialize authentication' })
    } finally {
      set({ isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      set({ 
        session: data.session, 
        user: data.user,
        isAuthenticated: !!data.session, 
      })
    } catch (error: any) {
      console.error('Login error:', error)
      set({ error: error.message || 'Login failed' })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true })
      await supabase.auth.signOut()
      set({ 
        session: null, 
        user: null, 
        isAuthenticated: false, 
        error: null,
      })
    } catch (error: any) {
      console.error('Logout error:', error)
      set({ error: error.message || 'Logout failed' })
    } finally {
      set({ isLoading: false })
    }
  }
}))