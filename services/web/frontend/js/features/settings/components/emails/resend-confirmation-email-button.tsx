import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import { Button } from 'react-bootstrap'
import { postJSON } from '../../../../infrastructure/fetch-json'
import useAsync from '../../../../shared/hooks/use-async'
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
        <Icon type="refresh" spin fw /> {t('sending')}...
      </>
    )
  }

  return (
    <>
      <Button
        className="btn-inline-link"
        disabled={state.isLoading}
        onClick={handleResendConfirmationEmail}
        bsStyle={null}
      >
        {t('resend_confirmation_email')}
      </Button>
      <br />
      {isError && (
        <div className="text-danger">{t('generic_something_went_wrong')}</div>
      )}
    </>
  )
}

export default ResendConfirmationEmailButton
