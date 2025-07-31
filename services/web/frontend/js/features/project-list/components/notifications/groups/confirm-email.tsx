import { Trans, useTranslation } from 'react-i18next'
import Notification from '../notification'
import getMeta from '../../../../../utils/meta'
import { useProjectListContext } from '../../../context/project-list-context'
import { UserEmailData } from '../../../../../../../types/user-email'
import ResendConfirmationCodeModal from '@/features/settings/components/emails/resend-confirmation-code-modal'
import { ReactNode, useState } from 'react'

const ssoAvailable = ({ samlProviderId, affiliation }: UserEmailData) => {
  const { hasSamlFeature, hasSamlBeta } = getMeta('ol-ExposedSettings')

  if (!hasSamlFeature) {
    return false
  }
  if (samlProviderId) {
    return true
  }
  if (!affiliation?.institution) {
    return false
  }
  if (affiliation.institution.ssoEnabled) {
    return true
  }
  if (hasSamlBeta && affiliation.institution.ssoBeta) {
    return true
  }
  return false
}

function emailHasLicenceAfterConfirming(emailData: UserEmailData) {
  if (emailData.confirmedAt) {
    return false
  }
  if (!emailData.affiliation) {
    return false
  }
  const affiliation = emailData.affiliation
  const institution = affiliation.institution
  if (!institution) {
    return false
  }
  if (!institution.confirmed) {
    return false
  }
  if (affiliation.pastReconfirmDate) {
    return false
  }

  return affiliation.institution.commonsAccount
}

function isOnFreeOrIndividualPlan() {
  const subscription = getMeta('ol-usersBestSubscription')
  if (!subscription) {
    return false
  }
  const { type } = subscription
  return (
    type === 'free' || type === 'individual' || type === 'standalone-ai-add-on'
  )
}

const showConfirmEmail = (userEmail: UserEmailData) => {
  const { emailConfirmationDisabled } = getMeta('ol-ExposedSettings')

  return !emailConfirmationDisabled && !ssoAvailable(userEmail)
}

const EMAIL_DELETION_SCHEDULE = {
  '2025-06-03': '2017-12-31',
  '2025-07-03': '2019-12-31',
  '2025-08-03': '2021-12-31',
  '2025-09-03': '2025-03-03',
}

const dateOptions: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}

// Emails that remain unconfirmed after 90 days will be removed from the account
function getEmailDeletionDate(emailData: UserEmailData, signUpDate: string) {
  if (emailData.default) return false
  if (emailData.confirmedAt) return false

  if (!signUpDate) return false

  const currentDate = new Date()

  for (const [deletionDate, cutoffDate] of Object.entries(
    EMAIL_DELETION_SCHEDULE
  )) {
    const emailSignupDate = new Date(signUpDate)
    const emailCutoffDate = new Date(cutoffDate)
    const emailDeletionDate = new Date(deletionDate)

    if (emailSignupDate < emailCutoffDate) {
      const notificationStartDate = new Date(
        emailDeletionDate.getTime() - 90 * 24 * 60 * 60 * 1000
      )
      if (currentDate >= notificationStartDate) {
        if (currentDate > emailDeletionDate) {
          return new Date().toLocaleDateString(undefined, dateOptions)
        }
        return emailDeletionDate.toLocaleDateString(undefined, dateOptions)
      }
    }
  }

  return false
}

function ConfirmEmailNotification({
  userEmail,
  signUpDate,
  setIsLoading,
  isLoading,
}: {
  userEmail: UserEmailData
  signUpDate: string
  setIsLoading: (loading: boolean) => void
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const [isSuccess, setIsSuccess] = useState(false)
  const emailAddress = userEmail.email

  // We consider secondary emails added on or after 22.03.2024 to be trusted for account recovery
  // https://github.com/overleaf/internal/pull/17572
  const emailTrustCutoffDate = new Date('2024-03-22')
  const emailDeletionDate = getEmailDeletionDate(userEmail, signUpDate)
  const isPrimary = userEmail.default

  const isEmailConfirmed = !!userEmail.lastConfirmedAt
  const isEmailTrusted =
    userEmail.lastConfirmedAt &&
    new Date(userEmail.lastConfirmedAt) >= emailTrustCutoffDate

  const shouldShowCommonsNotification =
    emailHasLicenceAfterConfirming(userEmail) && isOnFreeOrIndividualPlan()

  if (isSuccess) {
    return null
  }

  const confirmationCodeModal = (
    <ResendConfirmationCodeModal
      email={emailAddress}
      onSuccess={() => setIsSuccess(true)}
      setGroupLoading={setIsLoading}
      groupLoading={isLoading}
      triggerVariant="secondary"
    />
  )

  let notificationType: 'info' | 'warning' | undefined
  let notificationBody: ReactNode | undefined

  if (shouldShowCommonsNotification) {
    notificationType = 'info'
    notificationBody = (
      <>
        <Trans
          i18nKey="one_step_away_from_professional_features"
          components={[<strong />]} // eslint-disable-line react/jsx-key
        />
        <br />
        <Trans
          i18nKey="institution_has_overleaf_subscription"
          values={{
            institutionName: userEmail.affiliation?.institution.name,
            emailAddress,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[<strong />]} // eslint-disable-line react/jsx-key
        />
      </>
    )
  } else if (!isEmailConfirmed) {
    notificationType = 'warning'
    notificationBody = (
      <>
        <p>
          {isPrimary ? (
            <Trans
              i18nKey="please_confirm_primary_email_or_edit"
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
              values={{ emailAddress }}
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a href="/user/settings" />,
              ]}
            />
          ) : (
            <Trans
              i18nKey="please_confirm_secondary_email_or_edit"
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
              values={{ emailAddress }}
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a href="/user/settings" />,
              ]}
            />
          )}
        </p>
        {emailDeletionDate && (
          <p>{t('email_remove_by_date', { date: emailDeletionDate })}</p>
        )}
      </>
    )
  } else if (!isEmailTrusted && !isPrimary) {
    notificationType = 'warning'
    notificationBody = (
      <>
        <p>
          <b>{t('confirm_secondary_email')}</b>
        </p>
        <p>{t('reconfirm_secondary_email', { emailAddress })}</p>
        <p>{t('ensure_recover_account')}</p>
      </>
    )
  }

  if (notificationType) {
    return (
      <Notification
        type={notificationType}
        content={notificationBody}
        action={confirmationCodeModal}
      />
    )
  }

  return null
}

function ConfirmEmail() {
  const { totalProjectsCount } = useProjectListContext()
  const userEmails = getMeta('ol-userEmails') || []
  const signUpDate = getMeta('ol-user')?.signUpDate
  const [isLoading, setIsLoading] = useState(false)

  if (!totalProjectsCount || !userEmails.length || !signUpDate) {
    return null
  }

  return (
    <>
      {userEmails.map(userEmail => {
        return showConfirmEmail(userEmail) ? (
          <ConfirmEmailNotification
            key={`confirm-email-${userEmail.email}`}
            userEmail={userEmail}
            signUpDate={signUpDate}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        ) : null
      })}
    </>
  )
}

export default ConfirmEmail
export { getEmailDeletionDate }
