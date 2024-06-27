import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export function RestoreFileErrorModal({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction
}) {
  const { t } = useTranslation()

  return (
    <Modal show onHide={resetErrorBoundary}>
      <Modal.Header closeButton>
        <Modal.Title>{t('restore_file_error_title')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{t('restore_file_error_message')}</Modal.Body>
      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary"
          onClick={resetErrorBoundary}
        >
          {t('close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
