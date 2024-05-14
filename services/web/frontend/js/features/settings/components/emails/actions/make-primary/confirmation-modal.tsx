import { useTranslation, Trans } from 'react-i18next'
import AccessibleModal from '../../../../../../shared/components/accessible-modal'
import { MergeAndOverride } from '../../../../../../../../types/utils'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/bootstrap-5/wrappers/ol-modal'

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
    <OLModal show={show} onHide={onHide}>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('confirm_primary_email_change')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
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
      </OLModalBody>
      <OLModalFooter>
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
      </OLModalFooter>
    </OLModal>
  )
}

export default ConfirmationModal
