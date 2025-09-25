import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import type { HistoryContextValue } from '../../../context/types/history-context-value'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { RestoreFileConfirmModal } from '../modals/restore-file-confirm-modal'
import { useState } from 'react'
import { RestoreFileErrorModal } from '../modals/restore-file-error-modal'
import { useRestoreSelectedFile } from '@/features/history/context/hooks/use-restore-selected-file'

type ToolbarRevertingFileButtonProps = {
  selection: HistoryContextValue['selection']
}

function ToolbarRestoreFileToVersionButton({
  selection,
}: ToolbarRevertingFileButtonProps) {
  const { t } = useTranslation()
  const { restoreSelectedFile, isLoading } = useRestoreSelectedFile()
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  if (!selection.updateRange || !selection.selectedFile) {
    return null
  }

  return (
    <>
      <RestoreFileConfirmModal
        show={showConfirmModal}
        timestamp={selection.updateRange.toVTimestamp}
        onConfirm={() => {
          setShowConfirmModal(false)
          restoreSelectedFile(selection)
        }}
        onHide={() => setShowConfirmModal(false)}
      />
      <OLButton
        variant="secondary"
        size="sm"
        isLoading={isLoading}
        loadingLabel={t('restoring')}
        onClick={() => setShowConfirmModal(true)}
      >
        {t('restore_file_version')}
      </OLButton>
    </>
  )
}

export default withErrorBoundary(
  ToolbarRestoreFileToVersionButton,
  RestoreFileErrorModal
)
