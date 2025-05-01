import './base'
import { createRoot } from 'react-dom/client'
import InviteRoot from '@/features/subscription/components/invite-root'

const element = document.getElementById('invite-root')

if (element) {
  const root = createRoot(element)
  root.render(<InviteRoot />)
}
