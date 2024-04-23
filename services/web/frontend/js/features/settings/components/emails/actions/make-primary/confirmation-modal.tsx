import { useTranslation, Trans } from 'react-i18next'
import { Modal } from 'react-bootstrap'
import AccessibleModal from '../../../../../../shared/components/accessible-modal'
import { MergeAndOverride } from '../../../../../../../../types/utils'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

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
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        </p>
        <p className="mb-0">{t('log_in_with_primary_email_address')}</p>
      </Modal.Body>
      <Modal.Footer>
        <ButtonWrapper
          variant="secondary"
          onClick={onHide}
          bs3Props={{
            bsStyle: null,
            className: 'btn-secondary-info btn-secondary',
          }}
        >
          {t('cancel')}
        </ButtonWrapper>
        <ButtonWrapper
          variant="primary"
          disabled={isConfirmDisabled}
          onClick={onConfirm}
          bs3Props={{ bsStyle: null, className: 'btn-primary' }}
        >
          {t('confirm')}
        </ButtonWrapper>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default ConfirmationModal
