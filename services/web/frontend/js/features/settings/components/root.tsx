import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import EmailsSection from './emails-section'
import AccountInfoSection from './account-info-section'
import ManagedAccountAlert from './managed-account-alert'
import PasswordSection from './password-section'
import LinkingSection from './linking-section'
import BetaProgramSection from './beta-program-section'
import LabsProgramSection from './labs-program-section'
import SessionsSection from './sessions-section'
import NewsletterSection from './newsletter-section'
import LeaveSection from './leave-section'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { UserProvider } from '../../../shared/context/user-context'
import { SSOProvider } from '../context/sso-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import useScrollToIdOnLoad from '../../../shared/hooks/use-scroll-to-id-on-load'
import { ExposedSettings } from '../../../../../types/exposed-settings'
import { SSOAlert } from './emails/sso-alert'

function SettingsPageRoot() {
  const { isReady } = useWaitForI18n()
  useScrollToIdOnLoad()

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
  const { isOverleaf, labsEnabled } = getMeta(
    'ol-ExposedSettings'
  ) as ExposedSettings

  return (
    <UserProvider>
      <div className="card">
        <div className="page-header">
          <h1>{t('account_settings')}</h1>
        </div>
        <div>
          <ManagedAccountAlert />
          <EmailsSection />
          <SSOAlert />
          <div className="row">
            <div className="col-md-5">
              <AccountInfoSection />
            </div>
            <div className="col-md-5 col-md-offset-1">
              <PasswordSection />
            </div>
          </div>
          <hr />
          <SplitTestProvider>
            <SSOProvider>
              <LinkingSection />
            </SSOProvider>
          </SplitTestProvider>
          {isOverleaf ? (
            <>
              <BetaProgramSection />
              <hr />
            </>
          ) : null}
          {labsEnabled ? (
            <>
              <LabsProgramSection />
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
