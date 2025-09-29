import { useTranslation, Trans } from 'react-i18next'
import { MergeAndOverride } from '../../../../../../../../types/utils'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { type UserEmailData } from '../../../../../../../../types/user-email'

type ConfirmationModalProps = MergeAndOverride<
  React.ComponentProps<typeof OLModal>,
  {
    email: string
    isConfirmDisabled: boolean
    onConfirm: () => void
    onHide: () => void
    primary?: UserEmailData
  }
>

function ConfirmationModal({
  email,
  isConfirmDisabled,
  show,
  onConfirm,
  onHide,
  primary,
}: ConfirmationModalProps) {
  const { t } = useTranslation()

  return (
    <OLModal show={show} onHide={onHide}>
      <OLModalHeader>
        <OLModalTitle>{t('confirm_primary_email_change')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="pb-0">
        <p>
          <Trans
            i18nKey="do_you_want_to_change_your_primary_email_address_to"
            components={{ b: <b /> }}
            values={{ email }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        </p>
        <p>{t('log_in_with_primary_email_address')}</p>
        {primary && !primary.confirmedAt && (
          <p>
            <Trans
              i18nKey="this_will_remove_primary_email"
              components={{ b: <b /> }}
              values={{ email: primary.email }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          </p>
        )}
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
          {t('change_primary_email')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default ConfirmationModal
