import '../base'
import { createRoot } from 'react-dom/client'
import GroupMembers from '../../../../features/group-management/components/group-members'
import { GroupMembersProvider } from '../../../../features/group-management/context/group-members-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  const root = createRoot(element)
  root.render(
    <SplitTestProvider>
      <GroupMembersProvider>
        <GroupMembers />
      </GroupMembersProvider>
    </SplitTestProvider>
  )
}
