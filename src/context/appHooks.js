import { useContext, useMemo } from 'react'
import { AppActionsContext, AppStateContext } from './appContextCore'

export const useAppState = () => useContext(AppStateContext)
export const useAppActions = () => useContext(AppActionsContext)

export const useApp = () => {
  const state = useAppState()
  const actions = useAppActions()
  return useMemo(() => ({ state, ...actions }), [state, actions])
}
