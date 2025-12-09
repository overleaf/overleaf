import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import {
  OnlineUser,
  useOnlineUsersContext,
} from '@/features/ide-react/context/online-users-context'
import { useCallback } from 'react'
import { OnlineUsersWidget } from '../online-users/online-users-widget'

export const OnlineUsers = () => {
  const { openDoc } = useEditorManagerContext()
  const { onlineUsersArray } = useOnlineUsersContext()

  const goToUser = useCallback(
    async (user: OnlineUser) => {
      if (user.doc && typeof user.row === 'number') {
        return await openDoc(user.doc, { gotoLine: user.row + 1 })
      }
    },
    [openDoc]
  )

  return (
    <div className="ide-redesign-online-users">
      <OnlineUsersWidget onlineUsers={onlineUsersArray} goToUser={goToUser} />
    </div>
  )
}
