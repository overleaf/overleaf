import OnlineUsersWidget from '@/features/editor-navigation-toolbar/components/online-users-widget'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import {
  OnlineUser,
  useOnlineUsersContext,
} from '@/features/ide-react/context/online-users-context'
import { useCallback } from 'react'

export const OnlineUsers = () => {
  const { openDoc } = useEditorManagerContext()
  const { onlineUsersArray } = useOnlineUsersContext()

  const goToUser = useCallback(
    (user: OnlineUser) => {
      if (user.doc && typeof user.row === 'number') {
        openDoc(user.doc, { gotoLine: user.row + 1 })
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
