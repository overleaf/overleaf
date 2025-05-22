import './../utils/meta'
import '../utils/webpack-public-path'
import './../infrastructure/error-reporter'
import './../features/header-footer-react'
import '@/i18n'
import { createRoot } from 'react-dom/client'
import SharingUpdatesRoot from '../features/token-access/components/sharing-updates-root'

const element = document.getElementById('sharing-updates-page')
if (element) {
  const root = createRoot(element)
  root.render(<SharingUpdatesRoot />)
}
