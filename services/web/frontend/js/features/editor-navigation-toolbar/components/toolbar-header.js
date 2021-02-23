import React from 'react'
import PropTypes from 'prop-types'
import MenuButton from './menu-button'
import CobrandingLogo from './cobranding-logo'
import BackToProjectsButton from './back-to-projects-button'
import ChatToggleButton from './chat-toggle-button'
import OnlineUsersWidget from './online-users-widget'
import TrackChangesToggleButton from './track-changes-toggle-button'
import HistoryToggleButton from './history-toggle-button'

function ToolbarHeader({
  cobranding,
  onShowLeftMenuClick,
  chatIsOpen,
  toggleChatOpen,
  reviewPanelOpen,
  toggleReviewPanelOpen,
  historyIsOpen,
  toggleHistoryOpen,
  unreadMessageCount,
  onlineUsers,
  goToUser,
  isRestrictedTokenMember
}) {
  return (
    <header className="toolbar toolbar-header toolbar-with-labels">
      <div className="toolbar-left">
        <MenuButton onClick={onShowLeftMenuClick} />
        {cobranding ? <CobrandingLogo {...cobranding} /> : null}
        <BackToProjectsButton />
      </div>
      <div className="toolbar-right">
        <OnlineUsersWidget onlineUsers={onlineUsers} goToUser={goToUser} />
        {!isRestrictedTokenMember && (
          <>
            <TrackChangesToggleButton
              onClick={toggleReviewPanelOpen}
              disabled={historyIsOpen}
              trackChangesIsOpen={reviewPanelOpen}
            />
            <HistoryToggleButton
              historyIsOpen={historyIsOpen}
              onClick={toggleHistoryOpen}
            />
            <ChatToggleButton
              chatIsOpen={chatIsOpen}
              onClick={toggleChatOpen}
              unreadMessageCount={unreadMessageCount}
            />
          </>
        )}
      </div>
    </header>
  )
}

ToolbarHeader.propTypes = {
  onShowLeftMenuClick: PropTypes.func.isRequired,
  cobranding: PropTypes.object,
  chatIsOpen: PropTypes.bool,
  toggleChatOpen: PropTypes.func.isRequired,
  reviewPanelOpen: PropTypes.bool,
  toggleReviewPanelOpen: PropTypes.func.isRequired,
  historyIsOpen: PropTypes.bool,
  toggleHistoryOpen: PropTypes.func.isRequired,
  unreadMessageCount: PropTypes.number.isRequired,
  onlineUsers: PropTypes.array.isRequired,
  goToUser: PropTypes.func.isRequired,
  isRestrictedTokenMember: PropTypes.bool
}

export default ToolbarHeader
