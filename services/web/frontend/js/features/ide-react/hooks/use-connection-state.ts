import { useEffect } from 'react'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useModalsContext } from '@/features/ide-react/context/modals-context'

export const useConnectionState = () => {
  const { connectionState } = useConnectionContext()
  const { showLockEditorMessageModal } = useModalsContext()

  // Show modal when editor is forcefully disconnected
  useEffect(() => {
    if (connectionState.forceDisconnected) {
      showLockEditorMessageModal(connectionState.forcedDisconnectDelay)
    }
  }, [
    connectionState.forceDisconnected,
    connectionState.forcedDisconnectDelay,
    showLockEditorMessageModal,
  ])
}
