import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import ResendConfirmationEmailButton from './resend-confirmation-email-button'
import { ssoAvailableForInstitution } from '../../utils/sso'

type EmailProps = {
  userEmailData: UserEmailData
}

function Email({ userEmailData }: EmailProps) {
  const { t } = useTranslation()

  const ssoAvailable = ssoAvailableForInstitution(
    userEmailData.affiliation?.institution || null
  )

  return (
    <>
      {userEmailData.email}
      {userEmailData.default ? ' (primary)' : ''}
      {!userEmailData.confirmedAt && (
        <div className="small">
          <strong>
            {t('unconfirmed')}.
            {!ssoAvailable && <span> {t('please_check_your_inbox')}.</span>}
          </strong>
          <br />
          {!ssoAvailable && (
            <ResendConfirmationEmailButton email={userEmailData.email} />
          )}
        </div>
      )}
      {userEmailData.confirmedAt &&
        userEmailData.affiliation?.institution.confirmed &&
        userEmailData.affiliation.licence !== 'free' && (
          <div className="small">
            <span className="label label-primary">{t('professional')}</span>
          </div>
        )}
    </>
  )
}

export default Email
