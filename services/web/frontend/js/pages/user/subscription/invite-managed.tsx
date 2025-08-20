import './base'
import { createRoot } from 'react-dom/client'
import InvitedManagedRoot from '../../../features/subscription/components/invite-managed-root'

const element = document.getElementById('invite-managed-root')
if (element) {
  const root = createRoot(element)
  root.render(<InvitedManagedRoot />)
}
