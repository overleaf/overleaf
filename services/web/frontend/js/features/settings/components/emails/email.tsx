import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import { ssoAvailableForInstitution } from '../../utils/sso'
import OLBadge from '@/shared/components/ol/ol-badge'
import ResendConfirmationCodeModal from '@/features/settings/components/emails/resend-confirmation-code-modal'
import { useUserEmailsContext } from '@/features/settings/context/user-email-context'

type EmailProps = {
  userEmailData: UserEmailData
}

function Email({ userEmailData }: EmailProps) {
  const { t } = useTranslation()
  const {
    state,
    setLoading: setUserEmailsContextLoading,
    getEmails,
  } = useUserEmailsContext()
  const ssoAvailable = ssoAvailableForInstitution(
    userEmailData.affiliation?.institution || null
  )

  const isPrimary = userEmailData.default
  const isProfessional =
    userEmailData.confirmedAt &&
    userEmailData.affiliation?.institution.confirmed &&
    userEmailData.affiliation.licence !== 'free'
  const hasBadges = isPrimary || isProfessional

  return (
    <>
      {userEmailData.email}
      {!userEmailData.confirmedAt && (
        <div className="small">
          <strong>{t('unconfirmed')}.</strong>
          <br />
          {!ssoAvailable && (
            <ResendConfirmationCodeModal
              email={userEmailData.email}
              setGroupLoading={setUserEmailsContextLoading}
              groupLoading={state.isLoading}
              onSuccess={getEmails}
              triggerVariant="link"
            />
          )}
        </div>
      )}
      {hasBadges && (
        <div>
          {isPrimary && (
            <>
              <OLBadge bg="info">Primary</OLBadge>{' '}
            </>
          )}
          {isProfessional && (
            <OLBadge bg="primary">{t('professional')}</OLBadge>
          )}
        </div>
      )}
    </>
  )
}

export default Email
