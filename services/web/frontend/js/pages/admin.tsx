import { renderInReactLayout } from '@/react'
import '@/utils/meta'
import '@/utils/webpack-public-path'
import '@/infrastructure/error-reporter'
import '@/i18n'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import AdminConsoleRoot from '@/features/admin/admin-console-root'

renderInReactLayout('admin-console-root', () => (
  <SplitTestProvider>
    <AdminConsoleRoot />
  </SplitTestProvider>
))
