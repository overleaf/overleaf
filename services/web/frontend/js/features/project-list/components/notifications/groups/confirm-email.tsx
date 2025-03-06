import { Trans, useTranslation } from 'react-i18next'
import Notification from '../notification'
import getMeta from '../../../../../utils/meta'
import useAsync from '../../../../../shared/hooks/use-async'
import { useProjectListContext } from '../../../context/project-list-context'
import {
  postJSON,
  getUserFacingMessage,
} from '../../../../../infrastructure/fetch-json'
import { UserEmailData } from '../../../../../../../types/user-email'
import { debugConsole } from '@/utils/debugging'
import OLButton from '@/features/ui/components/ol/ol-button'
import LoadingSpinner from '@/shared/components/loading-spinner'

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
          return new Date().toLocaleDateString()
        }
        return emailDeletionDate.toLocaleDateString()
      }
    }
  }

  return false
}

function ConfirmEmailNotification({
  userEmail,
  signUpDate,
}: {
  userEmail: UserEmailData
  signUpDate: string
}) {
  const { t } = useTranslation()
  const { isLoading, isSuccess, isError, error, runAsync } = useAsync()

  // We consider secondary emails added on or after 22.03.2024 to be trusted for account recovery
  // https://github.com/overleaf/internal/pull/17572
  const emailTrustCutoffDate = new Date('2024-03-22')
  const emailDeletionDate = getEmailDeletionDate(userEmail, signUpDate)
  const isPrimary = userEmail.default

  const isEmailTrusted =
    userEmail.lastConfirmedAt &&
    new Date(userEmail.lastConfirmedAt) >= emailTrustCutoffDate

  const shouldShowCommonsNotification =
    emailHasLicenceAfterConfirming(userEmail) && isOnFreeOrIndividualPlan()

  const handleResendConfirmationEmail = ({ email }: UserEmailData) => {
    runAsync(
      postJSON('/user/emails/resend_confirmation', {
        body: { email },
      })
    ).catch(debugConsole.error)
  }

  if (isSuccess) {
    return null
  }

  if (!userEmail.lastConfirmedAt && !shouldShowCommonsNotification) {
    return (
      <Notification
        type="warning"
        content={
          <div data-testid="pro-notification-body">
            {isLoading ? (
              <div data-testid="loading-resending-confirmation-email">
                <LoadingSpinner
                  loadingText={t('resending_confirmation_email')}
                />
              </div>
            ) : isError ? (
              <div aria-live="polite">{getUserFacingMessage(error)}</div>
            ) : (
              <>
                <p>
                  {isPrimary
                    ? t('please_confirm_primary_email', {
                        emailAddress: userEmail.email,
                      })
                    : t('please_confirm_secondary_email', {
                        emailAddress: userEmail.email,
                      })}
                </p>
                {emailDeletionDate && (
                  <p>
                    {t('email_remove_by_date', { date: emailDeletionDate })}
                  </p>
                )}
              </>
            )}
          </div>
        }
        action={
          <>
            <OLButton
              variant="secondary"
              onClick={() => handleResendConfirmationEmail(userEmail)}
            >
              {t('resend_confirmation_email')}
            </OLButton>
            <OLButton variant="link" href="/user/settings">
              {isPrimary
                ? t('change_primary_email')
                : t('remove_email_address')}
            </OLButton>
          </>
        }
      />
    )
  }

  if (!isEmailTrusted && !isPrimary && !shouldShowCommonsNotification) {
    return (
      <Notification
        type="warning"
        content={
          <div data-testid="not-trusted-notification-body">
            {isLoading ? (
              <div data-testid="error-id">
                <LoadingSpinner
                  loadingText={t('resending_confirmation_email')}
                />
              </div>
            ) : isError ? (
              <div aria-live="polite">{getUserFacingMessage(error)}</div>
            ) : (
              <>
                <p>
                  <b>{t('confirm_secondary_email')}</b>
                </p>
                <p>
                  {t('reconfirm_secondary_email', {
                    emailAddress: userEmail.email,
                  })}
                </p>
                <p>{t('ensure_recover_account')}</p>
              </>
            )}
          </div>
        }
        action={
          <>
            <OLButton
              variant="secondary"
              onClick={() => handleResendConfirmationEmail(userEmail)}
            >
              {t('resend_confirmation_email')}
            </OLButton>
            <OLButton
              variant="link"
              href="/user/settings"
              style={{ textDecoration: 'underline' }}
            >
              {t('remove_email_address')}
            </OLButton>
          </>
        }
      />
    )
  }

  // Only show the notification if a) a commons license is available and b) the
  // user is on a free or individual plan. Users on a group or Commons plan
  // already have premium features.
  if (shouldShowCommonsNotification) {
    return (
      <Notification
        type="info"
        content={
          <div data-testid="notification-body">
            {isLoading ? (
              <LoadingSpinner loadingText={t('resending_confirmation_email')} />
            ) : isError ? (
              <div aria-live="polite">{getUserFacingMessage(error)}</div>
            ) : (
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
                    emailAddress: userEmail.email,
                  }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                  components={[<strong />]} // eslint-disable-line react/jsx-key
                />
              </>
            )}
          </div>
        }
        action={
          <OLButton
            variant="secondary"
            onClick={() => handleResendConfirmationEmail(userEmail)}
          >
            {t('resend_email')}
          </OLButton>
        }
      />
    )
  }

  return null
}

function ConfirmEmail() {
  const { totalProjectsCount } = useProjectListContext()
  const userEmails = getMeta('ol-userEmails') || []
  const signUpDate = getMeta('ol-user')?.signUpDate

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
          />
        ) : null
      })}
    </>
  )
}

export default ConfirmEmail
export { getEmailDeletionDate }
