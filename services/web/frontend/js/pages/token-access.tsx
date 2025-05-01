import './../utils/meta'
import '../utils/webpack-public-path'
import './../infrastructure/error-reporter'
import '@/i18n'
import { createRoot } from 'react-dom/client'
import TokenAccessRoot from '../features/token-access/components/token-access-root'

const element = document.getElementById('token-access-page')
if (element) {
  const root = createRoot(element)
  root.render(<TokenAccessRoot />)
}
