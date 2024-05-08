import './base'
import ReactDOM from 'react-dom'
import InviteRoot from '@/features/subscription/components/invite-root'

const element = document.getElementById('invite-root')

if (element) {
  ReactDOM.render(<InviteRoot />, element)
}
