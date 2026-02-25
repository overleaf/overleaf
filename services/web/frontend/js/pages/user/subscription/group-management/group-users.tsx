import '../base'
import { createRoot } from 'react-dom/client'
import GroupUsers from '../../../../features/group-management/components/group-users'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  const root = createRoot(element)
  root.render(
    <GroupMembersProvider>
      <GroupUsers />
    </GroupMembersProvider>
  )
}
