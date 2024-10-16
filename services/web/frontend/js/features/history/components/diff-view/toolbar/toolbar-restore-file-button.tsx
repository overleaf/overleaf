import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { useRestoreDeletedFile } from '../../../context/hooks/use-restore-deleted-file'
import type { HistoryContextValue } from '../../../context/types/history-context-value'

type ToolbarRestoreFileButtonProps = {
  selection: HistoryContextValue['selection']
}

export default function ToolbarRestoreFileButton({
  selection,
}: ToolbarRestoreFileButtonProps) {
  const { t } = useTranslation()

  const { restoreDeletedFile, isLoading } = useRestoreDeletedFile()

  return (
    <OLButton
      variant="secondary"
      size="sm"
      className="history-react-toolbar-restore-file-button"
      isLoading={isLoading}
      onClick={() => restoreDeletedFile(selection)}
      bs3Props={{
        bsSize: 'xsmall',
        loading: isLoading ? `${t('restoring')}…` : t('restore_file'),
      }}
    >
      {t('restore_file')}
    </OLButton>
  )
}
