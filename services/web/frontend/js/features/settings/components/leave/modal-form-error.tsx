import { Alert } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { FetchError } from '../../../../infrastructure/fetch-json'
import { ExposedSettings } from '../../../../../../types/exposed-settings'

type LeaveModalFormErrorProps = {
  error: FetchError
}

function LeaveModalFormError({ error }: LeaveModalFormErrorProps) {
  const { t } = useTranslation()
  const { isOverleaf } = getMeta('ol-ExposedSettings') as ExposedSettings

  let errorMessage
  let errorTip = null
  if (error.response?.status === 403) {
    errorMessage = t('email_or_password_wrong_try_again')
    if (isOverleaf) {
      errorTip = (
        <Trans
          i18nKey="user_deletion_password_reset_tip"
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          components={[<a href="/user/password/reset" />]}
        />
      )
    }
  } else if (error.data?.error === 'SubscriptionAdminDeletionError') {
    errorMessage = t('subscription_admins_cannot_be_deleted')
  } else {
    errorMessage = t('user_deletion_error')
  }

  return (
    <Alert bsStyle="danger">
      {errorMessage}
      {errorTip ? (
        <>
          <br />
          {errorTip}
        </>
      ) : null}
    </Alert>
  )
}

export default LeaveModalFormError
