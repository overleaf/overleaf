import './../utils/meta'
import '../utils/webpack-public-path'
import './../infrastructure/error-reporter'
import '@/i18n'
import { createRoot } from 'react-dom/client'
import InviteNotValidRoot from '@/features/share-project/invite-not-valid-root'

const element = document.getElementById('project-invite-not-valid-page')
if (element) {
  const root = createRoot(element)
  root.render(<InviteNotValidRoot />)
}
