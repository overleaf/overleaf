import './base'
import { createRoot } from 'react-dom/client'
import GroupInvitesRoot from '@/features/subscription/components/group-invites/group-invites-root'

const element = document.getElementById('group-invites-root')
if (element) {
  const root = createRoot(element)
  root.render(<GroupInvitesRoot />)
}
