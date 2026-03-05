import './../utils/meta'
import '../utils/webpack-public-path'
import './../infrastructure/error-reporter'
import '@/i18n'
import { createRoot } from 'react-dom/client'
import InviteRoot from '@/features/share-project/invite-root'

const element = document.getElementById('project-invite-page')
if (element) {
  const root = createRoot(element)
  root.render(<InviteRoot />)
}
