import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  passwordRecovery: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
