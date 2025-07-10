import { useCallback, useState } from 'react'
import { useErrorBoundary } from 'react-error-boundary'
import { restoreProjectToVersion } from '../../services/api'
import { useLayoutContext } from '@/shared/context/layout-context'

type RestorationState = 'initial' | 'restoring' | 'restored' | 'error'

export const useRestoreProject = () => {
  const { showBoundary } = useErrorBoundary()
  const { restoreView } = useLayoutContext()

  const [restorationState, setRestorationState] =
    useState<RestorationState>('initial')

  const restoreProject = useCallback(
    (projectId: string, version: number) => {
      setRestorationState('restoring')
      restoreProjectToVersion(projectId, version)
        .then(() => {
          setRestorationState('restored')
          restoreView()
        })
        .catch(err => {
          setRestorationState('error')
          showBoundary(err)
        })
    },
    [showBoundary, restoreView]
  )

  return {
    restorationState,
    restoreProject,
    isRestoring: restorationState === 'restoring',
  }
}
