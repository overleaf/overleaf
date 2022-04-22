import { useEffect } from 'react'
import { Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import EmailsSection from './emails-section'
import AccountInfoSection from './account-info-section'
import PasswordSection from './password-section'
import IntegrationLinkingSection from './integration-linking-section'
import SSOLinkingSection from './sso-linking-section'
import MiscSection from './misc-section'
import LeaveSection from './leave-section'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { UserProvider } from '../../../shared/context/user-context'

function SettingsPageRoot() {
  const { t } = useTranslation()
  const ssoError = getMeta('ol-ssoError') as string

  useEffect(() => {
    eventTracking.sendMB('settings-view')
  }, [])

  return (
    <UserProvider>
      <div className="container">
        <div className="row">
          <div className="col-md-12 col-lg-10 col-lg-offset-1">
            {ssoError ? (
              <Alert bsStyle="danger">
                {t('sso_link_error')}: {t(ssoError)}
              </Alert>
            ) : null}
            <div className="card">
              <div className="page-header">
                <h1>{t('account_settings')}</h1>
              </div>
              <div className="account-settings">
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
                <IntegrationLinkingSection />
                <hr />
                <SSOLinkingSection />
                <hr />
                <MiscSection />
                <hr />
                <LeaveSection />
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserProvider>
  )
}

export default SettingsPageRoot
