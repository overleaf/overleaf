import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import { FetchError, postJSON } from '../../../../infrastructure/fetch-json'
import useAsync from '../../../../shared/hooks/use-async'
import { UserEmailData } from '../../../../../../types/user-email'
import { useUserEmailsContext } from '../../context/user-email-context'
import OLButton from '@/features/ui/components/ol/ol-button'

type ResendConfirmationEmailButtonProps = {
  email: UserEmailData['email']
}

function ResendConfirmationEmailButton({
  email,
}: ResendConfirmationEmailButtonProps) {
  const { t } = useTranslation()
  const { error, isLoading, isError, runAsync } = useAsync()
  const { state, setLoading: setUserEmailsContextLoading } =
    useUserEmailsContext()

  // Update global isLoading prop
  useEffect(() => {
    setUserEmailsContextLoading(isLoading)
  }, [setUserEmailsContextLoading, isLoading])

  const handleResendConfirmationEmail = () => {
    runAsync(
      postJSON('/user/emails/resend_confirmation', {
        body: {
          email,
        },
      })
    ).catch(() => {})
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
      <OLButton
        variant="link"
        disabled={state.isLoading || isLoading}
        onClick={handleResendConfirmationEmail}
        className="btn-inline-link"
      >
        {t('resend_confirmation_email')}
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

export default ResendConfirmationEmailButton
