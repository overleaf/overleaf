import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useChatContext } from '../../chat/context/chat-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useApplicationContext } from '../../../shared/context/application-context'

const applicationContextPropTypes = {
  user: PropTypes.object,
}

const editorContextPropTypes = {
  cobranding: PropTypes.object,
  loading: PropTypes.bool,
  isRestrictedTokenMember: PropTypes.bool,
  projectName: PropTypes.string.isRequired,
  renameProject: PropTypes.func.isRequired,
  isProjectOwner: PropTypes.bool,
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
    const { user } = useApplicationContext(applicationContextPropTypes)

    const {
      cobranding,
      loading,
      isRestrictedTokenMember,
      projectName,
      renameProject,
      isProjectOwner,
    } = useEditorContext(editorContextPropTypes)

    const {
      chatIsOpen,
      setChatIsOpen,
      reviewPanelOpen,
      setReviewPanelOpen,
      view,
      setView,
      setLeftMenuShown,
      pdfLayout,
    } = useLayoutContext(layoutContextPropTypes)

    const { markMessagesAsRead, unreadMessageCount } = useChatContext(
      chatContextPropTypes
    )

    const toggleChatOpen = useCallback(() => {
      if (!chatIsOpen) {
        markMessagesAsRead()
      }
      setChatIsOpen(value => !value)
    }, [chatIsOpen, setChatIsOpen, markMessagesAsRead])

    const toggleReviewPanelOpen = useCallback(
      () => setReviewPanelOpen(value => !value),
      [setReviewPanelOpen]
    )

    const toggleHistoryOpen = useCallback(() => {
      setView(view === 'history' ? 'editor' : 'history')
    }, [view, setView])

    const togglePdfView = useCallback(() => {
      setView(view === 'pdf' ? 'editor' : 'pdf')
    }, [view, setView])

    const openShareModal = useCallback(() => {
      openShareProjectModal(isProjectOwner)
    }, [openShareProjectModal, isProjectOwner])

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
        isAnonymousUser={user == null}
        projectName={projectName}
        renameProject={renameProject}
        openShareModal={openShareModal}
        pdfViewIsOpen={view === 'pdf'}
        pdfButtonIsVisible={pdfLayout === 'flat'}
        togglePdfView={togglePdfView}
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
