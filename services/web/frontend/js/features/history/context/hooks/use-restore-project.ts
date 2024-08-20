import { useCallback, useState } from 'react'
import { useErrorHandler } from 'react-error-boundary'
import { restoreProjectToVersion } from '../../services/api'
import { useLayoutContext } from '@/shared/context/layout-context'

type RestorationState = 'initial' | 'restoring' | 'restored' | 'error'

export const useRestoreProject = () => {
  const handleError = useErrorHandler()
  const { setView } = useLayoutContext()

  const [restorationState, setRestorationState] =
    useState<RestorationState>('initial')

  const restoreProject = useCallback(
    (projectId: string, version: number) => {
      setRestorationState('restoring')
      restoreProjectToVersion(projectId, version)
        .then(() => {
          setRestorationState('restored')
          setView('editor')
        })
        .catch(err => {
          setRestorationState('error')
          handleError(err)
        })
    },
    [handleError, setView]
  )

  return {
    restorationState,
    restoreProject,
    isRestoring: restorationState === 'restoring',
  }
}
