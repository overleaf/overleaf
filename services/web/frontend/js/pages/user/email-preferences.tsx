import { renderInReactLayout } from '@/react'
import '@/utils/meta'
import '@/utils/webpack-public-path'
import '@/infrastructure/error-reporter'
import '@/i18n'
import EmailPreferencesRoot from '@/features/settings/components/email-preferences/root'
import { UserProvider } from '@/shared/context/user-context'

renderInReactLayout('email-preferences-root', () => (
  <UserProvider>
    <EmailPreferencesRoot />
  </UserProvider>
))
