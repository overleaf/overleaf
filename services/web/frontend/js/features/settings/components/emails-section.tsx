import { Fragment } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  UserEmailsProvider,
  useUserEmailsContext,
} from '../context/user-email-context'
import EmailsHeader from './emails/header'
import EmailsRow from './emails/row'

function EmailsSectionContent() {
  const { t } = useTranslation()
  const {
    state: { data: userEmailsData },
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
      <EmailsHeader />
      {userEmails?.map((userEmail, i) => (
        <Fragment key={userEmail.email}>
          <EmailsRow userEmailData={userEmail} />
          {i + 1 !== userEmails.length && (
            <div className="horizontal-divider" />
          )}
        </Fragment>
      ))}
    </>
  )
}

function EmailsSection() {
  return (
    <UserEmailsProvider>
      <EmailsSectionContent />
    </UserEmailsProvider>
  )
}

export default EmailsSection
