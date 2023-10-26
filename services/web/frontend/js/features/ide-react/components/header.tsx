import React, { useCallback } from 'react'
import ChatToggleButton from '@/features/editor-navigation-toolbar/components/chat-toggle-button'
import HistoryToggleButton from '@/features/editor-navigation-toolbar/components/history-toggle-button'
import LayoutDropdownButton from '@/features/editor-navigation-toolbar/components/layout-dropdown-button'
import MenuButton from '@/features/editor-navigation-toolbar/components/menu-button'
import { useLayoutContext } from '@/shared/context/layout-context'
import { sendMB } from '@/infrastructure/event-tracking'
import OnlineUsersWidget from '@/features/editor-navigation-toolbar/components/online-users-widget'
import { useOnlineUsersContext } from '@/features/ide-react/context/online-users-context'

type HeaderProps = {
  chatIsOpen: boolean
  setChatIsOpen: (chatIsOpen: boolean) => void
  historyIsOpen: boolean
  setHistoryIsOpen: (historyIsOpen: boolean) => void
}

export default function Header({
  chatIsOpen,
  setChatIsOpen,
  historyIsOpen,
  setHistoryIsOpen,
}: HeaderProps) {
  const { setLeftMenuShown } = useLayoutContext()
  const { onlineUsersArray } = useOnlineUsersContext()

  function toggleChatOpen() {
    setChatIsOpen(!chatIsOpen)
  }

  function toggleHistoryOpen() {
    setHistoryIsOpen(!historyIsOpen)
  }

  const handleShowLeftMenuClick = useCallback(() => {
    sendMB('navigation-clicked-menu')
    setLeftMenuShown(value => !value)
  }, [setLeftMenuShown])

  return (
    <header className="toolbar toolbar-header">
      <div className="toolbar-left">
        <MenuButton onClick={handleShowLeftMenuClick} />
      </div>
      <div className="toolbar-right">
        <OnlineUsersWidget
          onlineUsers={onlineUsersArray}
          goToUser={() => alert('Not implemented')}
        />
        <LayoutDropdownButton />
        <HistoryToggleButton
          historyIsOpen={historyIsOpen}
          onClick={toggleHistoryOpen}
        />
        <ChatToggleButton
          chatIsOpen={chatIsOpen}
          onClick={toggleChatOpen}
          unreadMessageCount={0}
        />
      </div>
    </header>
  )
}
