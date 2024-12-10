import { memo, useMemo } from 'react'
import { useChangesUsersContext } from '../context/changes-users-context'
import { Change } from '../../../../../types/change'
import ReviewPanelEntryUser from './review-panel-entry-user'

export const ReviewPanelChangeUser = memo<{ change: Change }>(({ change }) => {
  const changesUsers = useChangesUsersContext()
  const userId = change.metadata?.user_id
  const user = useMemo(
    () => (userId ? changesUsers?.get(userId) : undefined),
    [changesUsers, userId]
  )

  return <ReviewPanelEntryUser user={user} />
})
ReviewPanelChangeUser.displayName = 'ReviewPanelChangeUser'
