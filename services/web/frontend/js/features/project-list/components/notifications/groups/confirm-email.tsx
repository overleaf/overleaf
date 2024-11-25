import { Trans, useTranslation } from 'react-i18next'
import Notification from '../notification'
import Icon from '../../../../../shared/components/icon'
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

  return (
    !emailConfirmationDisabled &&
    !userEmail.confirmedAt &&
    !ssoAvailable(userEmail)
  )
}

function ConfirmEmailNotification({ userEmail }: { userEmail: UserEmailData }) {
  const { t } = useTranslation()
  const { isLoading, isSuccess, isError, error, runAsync } = useAsync()

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

  // Only show the notification if a) a commons license is available and b) the
  // user is on a free or individual plan. Users on a group or Commons plan
  // already have premium features.
  if (emailHasLicenceAfterConfirming(userEmail) && isOnFreeOrIndividualPlan()) {
    return (
      <Notification
        type="info"
        content={
          <div data-testid="notification-body">
            {isLoading ? (
              <>
                <Icon type="spinner" spin /> {t('resending_confirmation_email')}
                &hellip;
              </>
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

  return (
    <Notification
      type="warning"
      content={
        <div data-testid="pro-notification-body">
          {isLoading ? (
            <>
              <Icon type="spinner" spin /> {t('resending_confirmation_email')}
              &hellip;
            </>
          ) : isError ? (
            <div aria-live="polite">{getUserFacingMessage(error)}</div>
          ) : (
            <>
              {t('please_confirm_email', {
                emailAddress: userEmail.email,
              })}{' '}
              <OLButton
                variant="link"
                onClick={() => handleResendConfirmationEmail(userEmail)}
                className="btn-inline-link"
              >
                {t('resend_confirmation_email')}
              </OLButton>
            </>
          )}
        </div>
      }
    />
  )
}

function ConfirmEmail() {
  const { totalProjectsCount } = useProjectListContext()
  const userEmails = getMeta('ol-userEmails') || []

  if (!totalProjectsCount || !userEmails.length) {
    return null
  }

  return (
    <>
      {userEmails.map(userEmail => {
        return showConfirmEmail(userEmail) ? (
          <ConfirmEmailNotification
            key={`confirm-email-${userEmail.email}`}
            userEmail={userEmail}
          />
        ) : null
      })}
    </>
  )
}

export default ConfirmEmail
