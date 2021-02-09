import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useChatContext } from '../../chat/context/chat-context'

function EditorNavigationToolbarRoot({ onShowLeftMenuClick }) {
  const { cobranding, loading, ui } = useEditorContext()
  const { resetUnreadMessageCount, unreadMessageCount } = useChatContext()

  const toggleChatOpen = useCallback(() => {
    if (!ui.chatIsOpen) {
      resetUnreadMessageCount()
    }
    ui.toggleChatOpen()
  }, [ui, resetUnreadMessageCount])

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
    />
  )
}

EditorNavigationToolbarRoot.propTypes = {
  onShowLeftMenuClick: PropTypes.func.isRequired
}
export default EditorNavigationToolbarRoot
