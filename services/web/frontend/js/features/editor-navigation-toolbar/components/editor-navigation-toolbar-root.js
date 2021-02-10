import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useChatContext } from '../../chat/context/chat-context'

function EditorNavigationToolbarRoot({ onShowLeftMenuClick }) {
  const {
    cobranding,
    loading,
    ui,
    onlineUsersArray,
    openDoc
  } = useEditorContext()
  const { resetUnreadMessageCount, unreadMessageCount } = useChatContext()

  const toggleChatOpen = useCallback(() => {
    if (!ui.chatIsOpen) {
      resetUnreadMessageCount()
    }
    ui.toggleChatOpen()
  }, [ui, resetUnreadMessageCount])

  function goToUser(user) {
    if (user.doc && typeof user.row === 'number') {
      openDoc(user.doc, { gotoLine: user.row + 1 })
    }
  }

  // using {display: 'none'} as 1:1 migration from Angular's ng-hide. Using
  // `loading ? null : <ToolbarHeader/>` causes UI glitches
  return (
    <ToolbarHeader
      style={loading ? { display: 'none' } : {}}
      cobranding={cobranding}
      onShowLeftMenuClick={onShowLeftMenuClick}
      chatIsOpen={ui.chatIsOpen}
      unreadMessageCount={unreadMessageCount}
      toggleChatOpen={toggleChatOpen}
      onlineUsers={onlineUsersArray}
      goToUser={goToUser}
    />
  )
}

EditorNavigationToolbarRoot.propTypes = {
  onShowLeftMenuClick: PropTypes.func.isRequired
}
export default EditorNavigationToolbarRoot
