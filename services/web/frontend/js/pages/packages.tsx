import { renderInReactLayout } from '@/react'
import '@/utils/meta'
import '@/utils/webpack-public-path'
import '@/infrastructure/error-reporter'
import '@/i18n'
import PackageHubRoot from '@/features/package-hub/components/package-hub-root'

renderInReactLayout('package-hub-root', () => <PackageHubRoot />)
