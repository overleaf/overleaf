import React from 'react'
import ChatToggleButton from '@/features/editor-navigation-toolbar/components/chat-toggle-button'
import HistoryToggleButton from '@/features/editor-navigation-toolbar/components/history-toggle-button'

type PlaceholderHeaderProps = {
  chatIsOpen: boolean
  setChatIsOpen: (chatIsOpen: boolean) => void
  historyIsOpen: boolean
  setHistoryIsOpen: (chatIsOpen: boolean) => void
}

export default function PlaceholderHeader({
  chatIsOpen,
  setChatIsOpen,
  historyIsOpen,
  setHistoryIsOpen,
}: PlaceholderHeaderProps) {
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
