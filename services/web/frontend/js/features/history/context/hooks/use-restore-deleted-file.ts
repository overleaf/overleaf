import { sendMB } from '../../../../infrastructure/event-tracking'
import { useIdeContext } from '../../../../shared/context/ide-context'
import { useLayoutContext } from '../../../../shared/context/layout-context'
import useAsync from '../../../../shared/hooks/use-async'
import { restoreFile } from '../../services/api'
import { isFileRemoved } from '../../utils/file-diff'
import { waitFor } from '../../utils/wait-for'
import { useHistoryContext } from '../history-context'
import type { HistoryContextValue } from '../types/history-context-value'
import { useErrorHandler } from 'react-error-boundary'

export function useRestoreDeletedFile() {
  const { isLoading, runAsync } = useAsync()
  const { projectId } = useHistoryContext()
  const ide = useIdeContext()
  const { setView } = useLayoutContext()
  const handleError = useErrorHandler()

  const restoreDeletedFile = async (
    selection: HistoryContextValue['selection']
  ) => {
    const { selectedFile } = selection

    if (selectedFile && selectedFile.pathname && isFileRemoved(selectedFile)) {
      sendMB('history-v2-restore-deleted')

      await runAsync(
        restoreFile(projectId, selectedFile)
          .then(async data => {
            const { id, type } = data

            const entity = await waitFor(
              () => ide.fileTreeManager.findEntityById(id),
              3000
            )

            if (type === 'doc') {
              ide.editorManager.openDoc(entity)
            } else {
              ide.binaryFilesManager.openFile(entity)
            }

            setView('editor')
          })
          .catch(handleError)
      )
    }
  }

  return { restoreDeletedFile, isLoading }
}
