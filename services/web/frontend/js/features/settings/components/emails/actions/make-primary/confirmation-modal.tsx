import { useTranslation, Trans } from 'react-i18next'
import { Modal, Button } from 'react-bootstrap'
import AccessibleModal from '../../../../../../shared/components/accessible-modal'
import { MergeAndOverride } from '../../../../../../../../types/utils'

type ConfirmationModalProps = MergeAndOverride<
  React.ComponentProps<typeof AccessibleModal>,
  {
    email: string
    isConfirmDisabled: boolean
    onConfirm: () => void
    onHide: () => void
  }
>

function ConfirmationModal({
  email,
  isConfirmDisabled,
  show,
  onConfirm,
  onHide,
}: ConfirmationModalProps) {
  const { t } = useTranslation()

  return (
    <AccessibleModal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{t('confirm_primary_email_change')}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="modal-body-share">
        <p>
          <Trans
            i18nKey="do_you_want_to_change_your_primary_email_address_to"
            components={{ b: <b /> }}
            values={{ email }}
          />
        </p>
        <p className="mb-0">{t('log_in_with_primary_email_address')}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary-info btn-secondary"
          onClick={onHide}
        >
          {t('cancel')}
        </Button>
        <Button
          type="button"
          bsStyle={null}
          className="btn-primary"
          disabled={isConfirmDisabled}
          onClick={onConfirm}
        >
          {t('confirm')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default ConfirmationModal
