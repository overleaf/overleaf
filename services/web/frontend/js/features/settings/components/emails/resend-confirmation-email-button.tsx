import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import { Button } from 'react-bootstrap'
import useAsync from '../../../../shared/hooks/use-async'
import { postJSON } from '../../../../infrastructure/fetch-json'
import { UserEmailData } from '../../../../../../types/user-email'
import { useUserEmailsContext } from '../../context/user-email-context'

type ResendConfirmationEmailButtonProps = {
  email: UserEmailData['email']
}

function ResendConfirmationEmailButton({
  email,
}: ResendConfirmationEmailButtonProps) {
  const { t } = useTranslation()
  const { isLoading, isError, runAsync } = useAsync()
  const { setLoading } = useUserEmailsContext()

  // Update global isLoading prop
  useEffect(() => {
    setLoading(isLoading)
  }, [setLoading, isLoading])

  const handleResendConfirmationEmail = () => {
    runAsync(
      postJSON('/user/emails/resend_confirmation', {
        body: {
          email,
        },
      })
    )
  }

  if (isLoading) {
    return (
      <>
        <Icon type="refresh" spin fw /> {t('sending')}...
      </>
    )
  }

  return (
    <>
      <Button
        className="btn-inline-link"
        onClick={handleResendConfirmationEmail}
      >
        {t('resend_confirmation_email')}
      </Button>
      <br />
      {isError && (
        <span className="text-danger">
          <Icon type="exclamation-triangle" fw />{' '}
          {t('error_performing_request')}
        </span>
      )}
    </>
  )
}

export default ResendConfirmationEmailButton
