import '../base'
import ReactDOM from 'react-dom'
import GroupMembers from '../../../../features/group-management/components/group-members'
import { GroupMembersProvider } from '../../../../features/group-management/context/group-members-context'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  ReactDOM.render(
    <GroupMembersProvider>
      <GroupMembers />
    </GroupMembersProvider>,
    element
  )
}
