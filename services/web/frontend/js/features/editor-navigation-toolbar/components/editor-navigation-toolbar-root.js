import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useChatContext } from '../../chat/context/chat-context'
import { useLayoutContext } from '../../../shared/context/layout-context'

const editorContextPropTypes = {
  cobranding: PropTypes.object,
  loading: PropTypes.bool,
  isRestrictedTokenMember: PropTypes.bool
}

const layoutContextPropTypes = {
  chatIsOpen: PropTypes.bool,
  setChatIsOpen: PropTypes.func.isRequired,
  reviewPanelOpen: PropTypes.bool,
  setReviewPanelOpen: PropTypes.func.isRequired,
  view: PropTypes.string,
  setView: PropTypes.func.isRequired,
  setLeftMenuShown: PropTypes.func.isRequired
}

function EditorNavigationToolbarRoot({ onlineUsersArray, openDoc }) {
  const { cobranding, loading, isRestrictedTokenMember } = useEditorContext(
    editorContextPropTypes
  )

  const {
    chatIsOpen,
    setChatIsOpen,
    reviewPanelOpen,
    setReviewPanelOpen,
    view,
    setView,
    setLeftMenuShown
  } = useLayoutContext(layoutContextPropTypes)

  const { resetUnreadMessageCount, unreadMessageCount } = useChatContext()

  const toggleChatOpen = useCallback(() => {
    if (!chatIsOpen) {
      resetUnreadMessageCount()
    }
    setChatIsOpen(value => !value)
  }, [chatIsOpen, setChatIsOpen, resetUnreadMessageCount])

  const toggleReviewPanelOpen = useCallback(
    () => setReviewPanelOpen(value => !value),
    [setReviewPanelOpen]
  )

  const toggleHistoryOpen = useCallback(() => {
    setView(view === 'history' ? 'editor' : 'history')
  }, [view, setView])

  const onShowLeftMenuClick = useCallback(
    () => setLeftMenuShown(value => !value),
    [setLeftMenuShown]
  )

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
      chatIsOpen={chatIsOpen}
      unreadMessageCount={unreadMessageCount}
      toggleChatOpen={toggleChatOpen}
      reviewPanelOpen={reviewPanelOpen}
      toggleReviewPanelOpen={toggleReviewPanelOpen}
      historyIsOpen={view === 'history'}
      toggleHistoryOpen={toggleHistoryOpen}
      onlineUsers={onlineUsersArray}
      goToUser={goToUser}
      isRestrictedTokenMember={isRestrictedTokenMember}
    />
  )
}

EditorNavigationToolbarRoot.propTypes = {
  onlineUsersArray: PropTypes.array.isRequired,
  openDoc: PropTypes.func.isRequired
}

export default EditorNavigationToolbarRoot
