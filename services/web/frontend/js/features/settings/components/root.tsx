import SecuritySection from '@/features/settings/components/security-section'
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
import RowWrapper from '@/features/ui/components/bootstrap-5/wrappers/row-wrapper'
import ColWrapper from '@/features/ui/components/bootstrap-5/wrappers/col-wrapper'
import CardWrapper from '@/features/ui/components/bootstrap-5/wrappers/card-wrapper'

function SettingsPageRoot() {
  const { isReady } = useWaitForI18n()
  useScrollToIdOnLoad()

  useEffect(() => {
    eventTracking.sendMB('settings-view')
  }, [])

  return (
    <div className="container">
      <RowWrapper>
        <ColWrapper md={12} lg={{ span: 10, offset: 1 }}>
          {isReady ? <SettingsPageContent /> : null}
        </ColWrapper>
      </RowWrapper>
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
      <CardWrapper>
        <div className="page-header">
          <h1>{t('account_settings')}</h1>
        </div>
        <div>
          <ManagedAccountAlert />
          <EmailsSection />
          <SSOAlert />
          <RowWrapper>
            <ColWrapper md={5}>
              <AccountInfoSection />
            </ColWrapper>
            <ColWrapper md={{ span: 5, offset: 1 }}>
              <PasswordSection />
            </ColWrapper>
          </RowWrapper>
          <hr />
          <SecuritySection />
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
      </CardWrapper>
    </UserProvider>
  )
}

export default SettingsPageRoot
