import { useCallback, useState, useEffect } from 'react'
import { useErrorBoundary } from 'react-error-boundary'
import { restoreProjectToVersion } from '../../services/api'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useHistoryContext } from '../history-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { RestoreProjectResponse } from '../../services/types/restore-file'

type RestorationState = 'initial' | 'restoring' | 'restored' | 'error'

export const useRestoreProject = () => {
  const { showBoundary } = useErrorBoundary()
  const { restoreView } = useLayoutContext()

  const [restorationState, setRestorationState] =
    useState<RestorationState>('initial')
  const { selection } = useHistoryContext()
  const { openDocWithId, openFileWithId } = useEditorManagerContext()
  const { fileTreeData } = useFileTreeData()
  const [restoredEntities, setRestoredEntities] =
    useState<RestoreProjectResponse | null>(null)

  useEffect(() => {
    if (restorationState === 'restoring' && restoredEntities) {
      const entity =
        restoredEntities.find(
          item => item.path === selection.selectedFile?.pathname
        ) || restoredEntities[0]

      if (entity) {
        const result = findInTree(fileTreeData, entity.id)
        if (result) {
          if (entity.type === 'doc') {
            openDocWithId(entity.id)
          } else if (entity.type === 'file') {
            openFileWithId(entity.id)
          }
        }
      }

      setRestorationState('restored')
      restoreView()
    }
  }, [
    fileTreeData,
    restoredEntities,
    openDocWithId,
    openFileWithId,
    restoreView,
    restorationState,
    selection.selectedFile?.pathname,
  ])

  const restoreProject = useCallback(
    (projectId: string, version: number) => {
      setRestorationState('restoring')
      restoreProjectToVersion(projectId, version)
        .then((res: RestoreProjectResponse) => {
          setRestoredEntities(res)
        })
        .catch(err => {
          setRestorationState('error')
          showBoundary(err)
        })
    },
    [showBoundary]
  )

  return {
    restorationState,
    restoreProject,
    isRestoring: restorationState === 'restoring',
  }
}
