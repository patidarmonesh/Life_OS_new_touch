import { useAppActions, useAppState } from '../context/appHooks'

export function useDrive() {
  const state = useAppState()
  const { refreshFromDrive } = useAppActions()

  return {
    syncStatus: state.syncStatus,
    lastSynced: state.lastSynced,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    refresh: refreshFromDrive,
  }
}
