import { useEffect } from 'react'
import { Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import EmailsSection from './emails-section'
import AccountInfoSection from './account-info-section'
import PasswordSection from './password-section'
import LinkingSection from './linking-section'
import BetaProgramSection from './beta-program-section'
import SessionsSection from './sessions-section'
import NewsletterSection from './newsletter-section'
import LeaveSection from './leave-section'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { UserProvider } from '../../../shared/context/user-context'
import { SSOProvider } from '../context/sso-context'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import { ExposedSettings } from '../../../../../types/exposed-settings'

function SettingsPageRoot() {
  const { isReady } = useWaitForI18n()

  useEffect(() => {
    eventTracking.sendMB('settings-view')
  }, [])

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-12 col-lg-10 col-lg-offset-1">
          {isReady ? <SettingsPageContent /> : null}
        </div>
      </div>
    </div>
  )
}

function SettingsPageContent() {
  const { t } = useTranslation()
  const ssoError = getMeta('ol-ssoError') as string
  const { isOverleaf } = getMeta('ol-ExposedSettings') as ExposedSettings

  return (
    <UserProvider>
      {ssoError ? (
        <Alert bsStyle="danger">
          {t('sso_link_error')}: {t(ssoError)}
        </Alert>
      ) : null}
      <div className="card">
        <div className="page-header">
          <h1>{t('account_settings')}</h1>
        </div>
        <div>
          <EmailsSection />
          <div className="row">
            <div className="col-md-5">
              <AccountInfoSection />
            </div>
            <div className="col-md-5 col-md-offset-1">
              <PasswordSection />
            </div>
          </div>
          <hr />
          <SSOProvider>
            <LinkingSection />
          </SSOProvider>
          {isOverleaf ? (
            <>
              <BetaProgramSection />
              <hr />
            </>
          ) : null}
          <SessionsSection />
          {isOverleaf ? (
            <>
              <hr />
              <NewsletterSection />
              <hr />
              <LeaveSection />
            </>
          ) : null}
        </div>
      </div>
    </UserProvider>
  )
}

export default SettingsPageRoot
