import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import useAsync from '../../../../shared/hooks/use-async'
import { UserEmailData } from '../../../../../../types/user-email'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { ConfirmEmailForm } from '@/features/settings/components/emails/confirm-email-form'

type ResendConfirmationEmailButtonProps = {
  email: UserEmailData['email']
  groupLoading: boolean
  setGroupLoading: (loading: boolean) => void
  onSuccess: () => void
  triggerVariant: 'link' | 'secondary'
}

function ResendConfirmationCodeModal({
  email,
  groupLoading,
  setGroupLoading,
  onSuccess,
  triggerVariant,
}: ResendConfirmationEmailButtonProps) {
  const { t } = useTranslation()
  const { error, isLoading, isError, runAsync } = useAsync()
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    setGroupLoading(isLoading)
  }, [isLoading, setGroupLoading])

  const handleResendConfirmationEmail = async () => {
    await runAsync(
      postJSON('/user/emails/send-confirmation-code', { body: { email } })
    )
      .catch(() => {})
      .finally(() => setModalVisible(true))
  }

  const rateLimited =
    error && error instanceof FetchError && error.response?.status === 429

  return (
    <>
      {modalVisible && (
        <OLModal
          animation
          show={modalVisible}
          onHide={() => setModalVisible(false)}
          id="action-project-modal"
          backdrop="static"
        >
          <OLModalHeader>
            <OLModalTitle>{t('confirm_your_email')}</OLModalTitle>
          </OLModalHeader>

          <OLModalBody>
            <ConfirmEmailForm
              isModal
              flow="resend"
              interstitial={false}
              resendEndpoint="/user/emails/resend-confirmation-code"
              confirmationEndpoint="/user/emails/confirm-code"
              email={email}
              onSuccessfulConfirmation={() => {
                onSuccess()
                setModalVisible(false)
              }}
              outerError={
                isError
                  ? rateLimited
                    ? t('too_many_requests')
                    : t('generic_something_went_wrong')
                  : undefined
              }
            />
          </OLModalBody>
          <OLModalFooter>
            <OLButton
              variant="secondary"
              disabled={isLoading}
              onClick={() => setModalVisible(false)}
            >
              {t('cancel')}
            </OLButton>
          </OLModalFooter>
        </OLModal>
      )}
      <OLButton
        variant={triggerVariant}
        disabled={groupLoading}
        isLoading={isLoading}
        loadingLabel={t('sending')}
        onClick={handleResendConfirmationEmail}
        className={triggerVariant === 'link' ? 'btn-inline-link' : undefined}
      >
        {t('send_confirmation_code')}
      </OLButton>
    </>
  )
}

export default ResendConfirmationCodeModal
