import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import type { HistoryContextValue } from '../../../context/types/history-context-value'
import { useRevertSelectedFile } from '@/features/history/context/hooks/use-revert-selected-file'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { RevertFileConfirmModal } from '../modals/revert-file-confirm-modal'
import { useState } from 'react'
import { RevertFileErrorModal } from '../modals/revert-file-error-modal'

type ToolbarRevertingFileButtonProps = {
  selection: HistoryContextValue['selection']
}

function ToolbarRevertFileButton({
  selection,
}: ToolbarRevertingFileButtonProps) {
  const { t } = useTranslation()
  const { revertSelectedFile, isLoading } = useRevertSelectedFile()
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  if (!selection.updateRange || !selection.selectedFile) {
    return null
  }

  return (
    <>
      <RevertFileConfirmModal
        show={showConfirmModal}
        timestamp={selection.updateRange.toVTimestamp}
        onConfirm={() => {
          setShowConfirmModal(false)
          revertSelectedFile(selection)
        }}
        onHide={() => setShowConfirmModal(false)}
      />
      <Button
        className="btn-secondary history-react-toolbar-revert-file-button"
        bsSize="xs"
        bsStyle={null}
        onClick={() => setShowConfirmModal(true)}
        disabled={isLoading}
      >
        {isLoading ? `${t('reverting')}…` : t('revert_file')}
      </Button>
    </>
  )
}

export default withErrorBoundary(ToolbarRevertFileButton, RevertFileErrorModal)
