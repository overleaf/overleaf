import './base'
import ReactDOM from 'react-dom'
import InvitedManagedRoot from '../../../features/subscription/components/invite-managed-root'

const element = document.getElementById('invite-managed-root')
if (element) {
  ReactDOM.render(<InvitedManagedRoot />, element)
}
