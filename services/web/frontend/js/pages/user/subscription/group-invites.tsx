import './base'
import ReactDOM from 'react-dom'
import GroupInvitesRoot from '@/features/subscription/components/group-invites/group-invites-root'

const element = document.getElementById('group-invites-root')
if (element) {
  ReactDOM.render(<GroupInvitesRoot />, element)
}
