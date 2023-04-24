import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useChatContext } from '../../chat/context/chat-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useProjectContext } from '../../../shared/context/project-context'

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

const layoutContextPropTypes = {
  chatIsOpen: PropTypes.bool,
  setChatIsOpen: PropTypes.func.isRequired,
  reviewPanelOpen: PropTypes.bool,
  setReviewPanelOpen: PropTypes.func.isRequired,
  view: PropTypes.string,
  setView: PropTypes.func.isRequired,
  setLeftMenuShown: PropTypes.func.isRequired,
  pdfLayout: PropTypes.string.isRequired,
}

const chatContextPropTypes = {
  markMessagesAsRead: PropTypes.func.isRequired,
  unreadMessageCount: PropTypes.number.isRequired,
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
    } = useLayoutContext(layoutContextPropTypes)

    const { markMessagesAsRead, unreadMessageCount } =
      useChatContext(chatContextPropTypes)

    const toggleChatOpen = useCallback(() => {
      if (!chatIsOpen) {
        markMessagesAsRead()
      }
      setChatIsOpen(value => !value)
    }, [chatIsOpen, setChatIsOpen, markMessagesAsRead])

    const toggleReviewPanelOpen = useCallback(
      event => {
        event.preventDefault()
        setReviewPanelOpen(value => !value)
      },
      [setReviewPanelOpen]
    )

    const toggleHistoryOpen = useCallback(() => {
      setView(view === 'history' ? 'editor' : 'history')
    }, [view, setView])

    const openShareModal = useCallback(() => {
      openShareProjectModal()
    }, [openShareProjectModal])

    const onShowLeftMenuClick = useCallback(
      () => setLeftMenuShown(value => !value),
      [setLeftMenuShown]
    )

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
