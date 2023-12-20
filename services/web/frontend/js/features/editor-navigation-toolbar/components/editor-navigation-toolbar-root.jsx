import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useChatContext } from '../../chat/context/chat-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useProjectContext } from '../../../shared/context/project-context'
import * as eventTracking from '../../../infrastructure/event-tracking'

const projectContextPropTypes = {
  name: PropTypes.string.isRequired,
  features: PropTypes.shape({
    trackChangesVisible: PropTypes.bool,
  }).isRequired,
}

const editorContextPropTypes = {
  cobranding: PropTypes.object,
  loading: PropTypes.bool,
  isRestrictedTokenMember: PropTypes.bool,
  renameProject: PropTypes.func.isRequired,
  isProjectOwner: PropTypes.bool,
  permissionsLevel: PropTypes.string,
}

const chatContextPropTypes = {
  markMessagesAsRead: PropTypes.func.isRequired,
  unreadMessageCount: PropTypes.number.isRequired,
}

function isOpentoString(open) {
  return open ? 'open' : 'close'
}

const EditorNavigationToolbarRoot = React.memo(
  function EditorNavigationToolbarRoot({
    onlineUsersArray,
    openDoc,
    openShareProjectModal,
  }) {
    const {
      name: projectName,
      features: { trackChangesVisible },
    } = useProjectContext(projectContextPropTypes)

    const {
      cobranding,
      loading,
      isRestrictedTokenMember,
      renameProject,
      permissionsLevel,
    } = useEditorContext(editorContextPropTypes)

    const {
      chatIsOpen,
      setChatIsOpen,
      reviewPanelOpen,
      setReviewPanelOpen,
      view,
      setView,
      setLeftMenuShown,
    } = useLayoutContext()

    const { markMessagesAsRead, unreadMessageCount } =
      useChatContext(chatContextPropTypes)

    const toggleChatOpen = useCallback(() => {
      if (!chatIsOpen) {
        markMessagesAsRead()
      }
      eventTracking.sendMB('navigation-clicked-chat', {
        action: isOpentoString(!chatIsOpen),
      })
      setChatIsOpen(!chatIsOpen)
    }, [chatIsOpen, setChatIsOpen, markMessagesAsRead])

    const toggleReviewPanelOpen = useCallback(
      event => {
        event.preventDefault()
        eventTracking.sendMB('navigation-clicked-review', {
          action: isOpentoString(!reviewPanelOpen),
        })
        setReviewPanelOpen(value => !value)
      },
      [reviewPanelOpen, setReviewPanelOpen]
    )

    const toggleHistoryOpen = useCallback(() => {
      const action = view === 'history' ? 'close' : 'open'
      eventTracking.sendMB('navigation-clicked-history', { action })
      setView(view === 'history' ? 'editor' : 'history')
    }, [view, setView])

    const openShareModal = useCallback(() => {
      eventTracking.sendMB('navigation-clicked-share')
      openShareProjectModal()
    }, [openShareProjectModal])

    const onShowLeftMenuClick = useCallback(() => {
      eventTracking.sendMB('navigation-clicked-menu')
      setLeftMenuShown(value => !value)
    }, [setLeftMenuShown])

    const goToUser = useCallback(
      user => {
        if (user.doc && typeof user.row === 'number') {
          openDoc(user.doc, { gotoLine: user.row + 1 })
        }
      },
      [openDoc]
    )

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
        hasPublishPermissions={
          permissionsLevel === 'owner' || permissionsLevel === 'readAndWrite'
        }
        projectName={projectName}
        renameProject={renameProject}
        hasRenamePermissions={permissionsLevel === 'owner'}
        openShareModal={openShareModal}
        trackChangesVisible={trackChangesVisible}
      />
    )
  }
)

EditorNavigationToolbarRoot.propTypes = {
  onlineUsersArray: PropTypes.array.isRequired,
  openDoc: PropTypes.func.isRequired,
  openShareProjectModal: PropTypes.func.isRequired,
}

export default EditorNavigationToolbarRoot
