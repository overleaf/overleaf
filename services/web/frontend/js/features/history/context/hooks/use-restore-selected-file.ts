import { useLayoutContext } from '../../../../shared/context/layout-context'
import { restoreFileToVersion } from '../../services/api'
import { isFileRemoved } from '../../utils/file-diff'
import { useHistoryContext } from '../history-context'
import type { HistoryContextValue } from '../types/history-context-value'
import { useErrorBoundary } from 'react-error-boundary'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { useCallback, useEffect, useState } from 'react'
import { RestoreFileResponse } from '../../services/types/restore-file'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

const RESTORE_FILE_TIMEOUT = 3000

type RestoreState =
  | 'idle'
  | 'restoring'
  | 'waitingForFileTree'
  | 'complete'
  | 'error'
  | 'timedOut'

export function useRestoreSelectedFile() {
  const { projectId } = useHistoryContext()
  const { restoreView } = useLayoutContext()
  const { openDocWithId, openFileWithId } = useEditorManagerContext()
  const { showBoundary } = useErrorBoundary()
  const { fileTreeData } = useFileTreeData()
  const [state, setState] = useState<RestoreState>('idle')
  const [restoredFileMetadata, setRestoredFileMetadata] =
    useState<RestoreFileResponse | null>(null)

  const isLoading = state === 'restoring' || state === 'waitingForFileTree'

  useEffect(() => {
    if (state === 'waitingForFileTree' && restoredFileMetadata) {
      const result = findInTree(fileTreeData, restoredFileMetadata.id)
      if (result) {
        setState('complete')
        const { _id: id } = result.entity
        restoreView()

        if (restoredFileMetadata.type === 'doc') {
          openDocWithId(id)
        } else {
          openFileWithId(id)
        }
      }
    }
  }, [
    state,
    fileTreeData,
    restoredFileMetadata,
    openDocWithId,
    openFileWithId,
    restoreView,
  ])

  useEffect(() => {
    if (state === 'waitingForFileTree') {
      const timer = window.setTimeout(() => {
        setState('timedOut')
        showBoundary(new Error('timed out'))
      }, RESTORE_FILE_TIMEOUT)

      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [showBoundary, state])

  const restoreSelectedFile = useCallback(
    (selection: HistoryContextValue['selection']) => {
      const { selectedFile, files } = selection

      if (selectedFile && selectedFile.pathname) {
        const file = files.find(file => file.pathname === selectedFile.pathname)

        if (file) {
          const deletedAtV = isFileRemoved(file) ? file.deletedAtV : undefined
          const toVersion = deletedAtV ?? selection.updateRange?.toV
          if (!toVersion) {
            return
          }
          setState('restoring')

          restoreFileToVersion(projectId, file.pathname, toVersion).then(
            (data: RestoreFileResponse) => {
              setRestoredFileMetadata(data)
              setState('waitingForFileTree')
            },
            error => {
              setState('error')
              showBoundary(error)
            }
          )
        }
      }
    },
    [showBoundary, projectId]
  )

  return { restoreSelectedFile, isLoading }
}
