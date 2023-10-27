import React from 'react'
import ChatToggleButton from '@/features/editor-navigation-toolbar/components/chat-toggle-button'
import ShareProjectButton from '@/features/editor-navigation-toolbar/components/share-project-button'
import HistoryToggleButton from '@/features/editor-navigation-toolbar/components/history-toggle-button'
import LayoutDropdownButton from '@/features/editor-navigation-toolbar/components/layout-dropdown-button'

type PlaceholderHeaderProps = {
  chatIsOpen: boolean
  setChatIsOpen: (chatIsOpen: boolean) => void
  historyIsOpen: boolean
  setHistoryIsOpen: (historyIsOpen: boolean) => void
}

export default function PlaceholderHeader({
  chatIsOpen,
  setChatIsOpen,
  historyIsOpen,
  setHistoryIsOpen,
}: PlaceholderHeaderProps) {
  function handleOpenShareModal() {}

  function toggleChatOpen() {
    setChatIsOpen(!chatIsOpen)
  }

  function toggleHistoryOpen() {
    setHistoryIsOpen(!historyIsOpen)
  }

  return (
    <header className="toolbar toolbar-header">
      <div className="toolbar-left">Header placeholder</div>
      <div className="toolbar-right">
        <ShareProjectButton onClick={handleOpenShareModal} />
        <HistoryToggleButton
          historyIsOpen={historyIsOpen}
          onClick={toggleHistoryOpen}
        />
        <LayoutDropdownButton />
        <ChatToggleButton
          chatIsOpen={chatIsOpen}
          onClick={toggleChatOpen}
          unreadMessageCount={0}
        />
      </div>
    </header>
  )
}
