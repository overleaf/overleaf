import { memo, useMemo } from 'react'
import { useChangesUsersContext } from '../context/changes-users-context'
import { buildName } from '../utils/build-name'
import { Change } from '../../../../../types/change'

export const ReviewPanelChangeUser = memo<{ change: Change }>(({ change }) => {
  const changesUsers = useChangesUsersContext()
  const userId = change.metadata?.user_id
  const userName = useMemo(
    () => buildName(userId ? changesUsers?.get(userId) : undefined),
    [changesUsers, userId]
  )

  return <span>{userName}</span>
})
ReviewPanelChangeUser.displayName = 'ReviewPanelChangeUser'
