import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useHistoryContext } from '../../../context/history-context'
import { useRestoreDeletedFile } from '../../../context/hooks/use-restore-deleted-file'
import type { HistoryContextValue } from '../../../context/types/history-context-value'

type ToolbarRestoreFileButtonProps = {
  selection: HistoryContextValue['selection']
}

export default function ToolbarRestoreFileButton({
  selection,
}: ToolbarRestoreFileButtonProps) {
  const { t } = useTranslation()
  const { loadingState } = useHistoryContext()

  const onRestoreFile = useRestoreDeletedFile()

  return (
    <Button
      className="btn-secondary history-react-toolbar-restore-file-button"
      bsSize="xs"
      bsStyle={null}
      onClick={() => onRestoreFile(selection)}
      disabled={loadingState === 'restoringFile'}
    >
      {loadingState === 'restoringFile'
        ? `${t('restoring')}…`
        : t('restore_file')}
    </Button>
  )
}
