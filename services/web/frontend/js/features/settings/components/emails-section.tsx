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
import { Alert } from 'react-bootstrap'
import { ExposedSettings } from '../../../../../types/exposed-settings'

function EmailsSectionContent() {
  const { t } = useTranslation()
  const {
    state: { data: userEmailsData },
    isInitializing,
    isInitializingError,
    isInitializingSuccess,
  } = useUserEmailsContext()
  const userEmails = Object.values(userEmailsData.byId)

  return (
    <>
      <h3>{t('emails_and_affiliations_title')}</h3>
      <p className="small">{t('emails_and_affiliations_explanation')}</p>
      <p className="small">
        <Trans i18nKey="change_primary_email_address_instructions">
          <strong />
          {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
          <a href="/learn/how-to/Keeping_your_account_secure" />
        </Trans>
      </p>
      <>
        <EmailsHeader />
        {isInitializing ? (
          <div className="affiliations-table-row--highlighted">
            <div className="affiliations-table-cell text-center">
              <Icon type="refresh" fw spin /> {t('loading')}...
            </div>
          </div>
        ) : (
          <>
            {userEmails?.map(userEmail => (
              <Fragment key={userEmail.email}>
                <EmailsRow userEmailData={userEmail} />
                <div className="horizontal-divider" />
              </Fragment>
            ))}
          </>
        )}
        {isInitializingSuccess && <AddEmail />}
        {isInitializingError && (
          <Alert bsStyle="danger" className="text-center">
            <Icon type="exclamation-triangle" fw />{' '}
            {t('error_performing_request')}
          </Alert>
        )}
      </>
    </>
  )
}

function EmailsSection() {
  const { hasAffiliationsFeature } = getMeta(
    'ol-ExposedSettings'
  ) as ExposedSettings
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
