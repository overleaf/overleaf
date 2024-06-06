import { useTranslation, Trans } from 'react-i18next'
import AccessibleModal from '../../../../../../shared/components/accessible-modal'
import { MergeAndOverride } from '../../../../../../../../types/utils'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

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
        <OLButton variant="secondary" onClick={onHide}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          disabled={isConfirmDisabled}
          onClick={onConfirm}
        >
          {t('confirm')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default ConfirmationModal
