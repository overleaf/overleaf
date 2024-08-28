import React, { useState, useCallback } from 'react'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useChatContext } from '../../chat/context/chat-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useProjectContext } from '../../../shared/context/project-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { Doc } from '../../../../../types/doc'

function isOpentoString(open: boolean) {
  return open ? 'open' : 'close'
}

const EditorNavigationToolbarRoot = React.memo(
  function EditorNavigationToolbarRoot({
    onlineUsersArray,
    openDoc,
    openShareProjectModal,
  }: {
    onlineUsersArray: any[]
    openDoc: (doc: Doc, { gotoLine }: { gotoLine: number }) => void
    openShareProjectModal: () => void
  }) {
    const {
      name: projectName,
      features: { trackChangesVisible },
    } = useProjectContext()

    const {
      cobranding,
      isRestrictedTokenMember,
      renameProject,
      permissionsLevel,
    } = useEditorContext()

    const {
      chatIsOpen,
      setChatIsOpen,
      reviewPanelOpen,
      setReviewPanelOpen,
      view,
      setView,
      setLeftMenuShown,
    } = useLayoutContext()

    const { markMessagesAsRead, unreadMessageCount } = useChatContext()

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

    const [shouldReopenChat, setShouldReopenChat] = useState(chatIsOpen)
    const toggleHistoryOpen = useCallback(() => {
      const action = view === 'history' ? 'close' : 'open'
      eventTracking.sendMB('navigation-clicked-history', { action })

      if (chatIsOpen && action === 'open') {
        setShouldReopenChat(true)
        toggleChatOpen()
      }
      if (shouldReopenChat && action === 'close') {
        setShouldReopenChat(false)
        toggleChatOpen()
      }
      setView(view === 'history' ? 'editor' : 'history')
    }, [view, chatIsOpen, shouldReopenChat, setView, toggleChatOpen])

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

    return (
      <ToolbarHeader
        // @ts-ignore: TODO(convert ToolbarHeader to TSX)
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
        chatVisible={!isRestrictedTokenMember}
        projectName={projectName}
        renameProject={renameProject}
        hasRenamePermissions={permissionsLevel === 'owner'}
        openShareModal={openShareModal}
        trackChangesVisible={trackChangesVisible}
      />
    )
  }
)

export default EditorNavigationToolbarRoot
