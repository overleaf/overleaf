import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import type { HistoryContextValue } from '../../../context/types/history-context-value'
import { useRevertSelectedFile } from '@/features/history/context/hooks/use-revert-selected-file'
import withErrorBoundary from '@/infrastructure/error-boundary'

type ToolbarRevertingFileButtonProps = {
  selection: HistoryContextValue['selection']
}

function ToolbarRevertFileButton({
  selection,
}: ToolbarRevertingFileButtonProps) {
  const { t } = useTranslation()
  const { revertSelectedFile, isLoading } = useRevertSelectedFile()

  return (
    <Button
      className="btn-secondary history-react-toolbar-revert-file-button"
      bsSize="xs"
      bsStyle={null}
      onClick={() => revertSelectedFile(selection)}
      disabled={isLoading}
    >
      {isLoading ? `${t('reverting')}…` : t('revert_file')}
    </Button>
  )
}

function ToolbarRevertErrorModal({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction
}) {
  const { t } = useTranslation()

  return (
    <Modal show onHide={resetErrorBoundary}>
      <Modal.Header closeButton>
        <Modal.Title>{t('revert_file_error_title')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{t('revert_file_error_message')}</Modal.Body>
      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary pull-left"
          onClick={resetErrorBoundary}
        >
          {t('close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default withErrorBoundary(
  ToolbarRevertFileButton,
  ToolbarRevertErrorModal
)
