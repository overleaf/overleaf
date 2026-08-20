import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../types/user-email'
import OLBadge from '@/shared/components/ol/ol-badge'
import ResendConfirmationCodeModal from '@/features/settings/components/emails/resend-confirmation-code-modal'
import { useUserEmailsContext } from '@/features/settings/context/user-email-context'
import { emailMustBeConfirmedViaSAML } from '../../utils/email-confirmation'

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
  const mustConfirmViaSAML = emailMustBeConfirmedViaSAML(
    userEmailData.affiliation || null
  )

  const isPrimary = userEmailData.default
  const hasInstitutionalSubscription =
    userEmailData.confirmedAt &&
    userEmailData.affiliation?.institution.confirmed &&
    userEmailData.affiliation.licence !== 'free'
  const hasCommonsAI =
    hasInstitutionalSubscription &&
    userEmailData.affiliation?.institution.writefullCommonsAccount === true
  const hasBadges = isPrimary || hasInstitutionalSubscription

  return (
    <>
      {userEmailData.email}
      {!userEmailData.confirmedAt && (
        <div className="small">
          <strong>{t('unconfirmed')}.</strong>
          <br />
          {!mustConfirmViaSAML && (
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
          {hasInstitutionalSubscription && (
            <OLBadge bg="primary">
              {hasCommonsAI ? t('commons_ai') : t('commons')}
            </OLBadge>
          )}
        </div>
      )}
    </>
  )
}

export default Email
