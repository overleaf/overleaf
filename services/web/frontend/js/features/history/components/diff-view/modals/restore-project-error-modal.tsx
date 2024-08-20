import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export function RestoreProjectErrorModal({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction
}) {
  const { t } = useTranslation()

  return (
    <Modal show onHide={resetErrorBoundary}>
      <Modal.Header closeButton>
        <Modal.Title>
          {t('an_error_occured_while_restoring_project')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {t(
          'there_was_a_problem_restoring_the_project_please_try_again_in_a_few_moments_or_contact_us'
        )}
      </Modal.Body>
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
