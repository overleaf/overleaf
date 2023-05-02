import { sendMB } from '../../../../infrastructure/event-tracking'
import { useIdeContext } from '../../../../shared/context/ide-context'
import { useLayoutContext } from '../../../../shared/context/layout-context'
import useAsync from '../../../../shared/hooks/use-async'
import { restoreFile } from '../../services/api'
import { isFileRemoved } from '../../utils/file-diff'
import { useHistoryContext } from '../history-context'
import type { HistoryContextValue } from '../types/history-context-value'

export function useRestoreDeletedFile() {
  const { runAsync } = useAsync()
  const { setLoadingState, projectId, setError } = useHistoryContext()
  const ide = useIdeContext()
  const { setView } = useLayoutContext()

  return async (selection: HistoryContextValue['selection']) => {
    const { selectedFile } = selection

    if (selectedFile && selectedFile.pathname && isFileRemoved(selectedFile)) {
      sendMB('history-v2-restore-deleted')
      setLoadingState('restoringFile')

      await runAsync(
        restoreFile(projectId, selectedFile)
          .then(data => {
            const { id, type } = data

            const entity = ide.fileTreeManager.findEntityById(id)

            if (type === 'doc') {
              ide.editorManager.openDoc(entity)
            } else {
              ide.binaryFilesManager.openFile(entity)
            }

            setView('editor')
          })
          .catch(error => setError(error))
          .finally(() => {
            setLoadingState('ready')
          })
      )
    }
  }
}
