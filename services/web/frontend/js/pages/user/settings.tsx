import '../../../stylesheets/pages/auth-launchpad.scss'
import { renderInReactLayout } from '@/react'
import '@/utils/meta'
import '@/utils/webpack-public-path'
import '@/infrastructure/error-reporter'
import '@/i18n'
import SettingsPageRoot from '@/features/settings/components/root'
import { SplitTestProvider } from '@/shared/context/split-test-context'

// For react-google-recaptcha
window.recaptchaOptions = {
  enterprise: true,
  useRecaptchaNet: true,
}
renderInReactLayout('settings-page-root', () => (
  <SplitTestProvider>
    <SettingsPageRoot />
  </SplitTestProvider>
))
