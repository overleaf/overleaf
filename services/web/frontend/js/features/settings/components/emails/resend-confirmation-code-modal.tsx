import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import useAsync from '../../../../shared/hooks/use-async'
import { UserEmailData } from '../../../../../../types/user-email'
import { useUserEmailsContext } from '../../context/user-email-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import { ConfirmEmailForm } from '@/features/settings/components/emails/confirm-email-form'

type ResendConfirmationEmailButtonProps = {
  email: UserEmailData['email']
}

function ResendConfirmationCodeModal({
  email,
}: ResendConfirmationEmailButtonProps) {
  const { t } = useTranslation()
  const { error, isLoading, isError, runAsync } = useAsync()
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    getEmails,
  } = useUserEmailsContext()
  const [modalVisible, setModalVisible] = useState(false)

  // Update global isLoading prop
  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  const handleResendConfirmationEmail = async () => {
    await runAsync(
      postJSON('/user/emails/send-confirmation-code', { body: { email } })
    )
      .then(() => setModalVisible(true))
      .catch(() => {})
  }

  if (isLoading) {
    return (
      <>
        <Icon type="refresh" spin fw /> {t('sending')}&hellip;
      </>
    )
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
          <OLModalHeader closeButton>
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
                getEmails()
                setModalVisible(false)
              }}
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
        variant="link"
        disabled={state.isLoading || isLoading}
        onClick={handleResendConfirmationEmail}
        className="btn-inline-link"
      >
        {t('resend_confirmation_code')}
      </OLButton>
      <br />
      {isError && (
        <div className="text-danger">
          {rateLimited
            ? t('too_many_requests')
            : t('generic_something_went_wrong')}
        </div>
      )}
    </>
  )
}

export default ResendConfirmationCodeModal
