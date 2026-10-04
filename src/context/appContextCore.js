import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const AppStateContext = createContext(null)
export const AppActionsContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}
