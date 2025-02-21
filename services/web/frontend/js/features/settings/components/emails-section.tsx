import { Fragment } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import getMeta from '../../../utils/meta'
import {
  UserEmailsProvider,
  useUserEmailsContext,
} from '../context/user-email-context'
import EmailsHeader from './emails/header'
import EmailsRow from './emails/row'
import AddEmail from './emails/add-email'
import Icon from '../../../shared/components/icon'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import { LeaversSurveyAlert } from './leavers-survey-alert'

function EmailsSectionContent() {
  const { t } = useTranslation()
  const {
    state: { data: userEmailsData },
    isInitializing,
    isInitializingError,
    isInitializingSuccess,
  } = useUserEmailsContext()
  const userEmails = Object.values(userEmailsData.byId)
  const primary = userEmails.find(userEmail => userEmail.default)

  // Only show the "add email" button if the user has permission to add a secondary email
  const hideAddSecondaryEmail = getMeta('ol-cannot-add-secondary-email')

  return (
    <>
      <h3>{t('emails_and_affiliations_title')}</h3>
      <p className="small">{t('emails_and_affiliations_explanation')}</p>
      <p className="small">
        <Trans
          i18nKey="change_primary_email_address_instructions"
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
            // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
            <a
              href="/learn/how-to/Managing_your_Overleaf_emails"
              target="_blank"
            />,
          ]}
        />
      </p>
      <>
        <EmailsHeader />
        {isInitializing ? (
          <div className="affiliations-table-row-highlighted">
            <div className="affiliations-table-cell text-center">
              <Icon type="refresh" fw spin /> {t('loading')}...
            </div>
          </div>
        ) : (
          <>
            {userEmails?.map(userEmail => (
              <Fragment key={userEmail.email}>
                <EmailsRow userEmailData={userEmail} primary={primary} />
                <div className="horizontal-divider" />
              </Fragment>
            ))}
          </>
        )}
        {isInitializingSuccess && <LeaversSurveyAlert />}
        {isInitializingSuccess && !hideAddSecondaryEmail && <AddEmail />}
        {isInitializingError && (
          <OLNotification
            type="error"
            content={t('error_performing_request')}
            bs3Props={{
              icon: <Icon type="exclamation-triangle" fw />,
              className: 'text-center',
            }}
          />
        )}
      </>
    </>
  )
}

function EmailsSection() {
  const { hasAffiliationsFeature } = getMeta('ol-ExposedSettings')
  if (!hasAffiliationsFeature) {
    return null
  }

  return (
    <>
      <UserEmailsProvider>
        <EmailsSectionContent />
      </UserEmailsProvider>
    </>
  )
}

export default EmailsSection
