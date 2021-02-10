import React from 'react'
import PropTypes from 'prop-types'
import MenuButton from './menu-button'
import CobrandingLogo from './cobranding-logo'
import BackToProjectsButton from './back-to-projects-button'
import ChatToggleButton from './chat-toggle-button'
import OnlineUsersWidget from './online-users-widget'

function ToolbarHeader({
  cobranding,
  onShowLeftMenuClick,
  chatIsOpen,
  toggleChatOpen,
  unreadMessageCount,
  onlineUsers,
  goToUser
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
        <ChatToggleButton
          chatIsOpen={chatIsOpen}
          onClick={toggleChatOpen}
          unreadMessageCount={unreadMessageCount}
        />
      </div>
    </header>
  )
}

ToolbarHeader.propTypes = {
  onShowLeftMenuClick: PropTypes.func.isRequired,
  cobranding: PropTypes.object,
  chatIsOpen: PropTypes.bool,
  toggleChatOpen: PropTypes.func.isRequired,
  unreadMessageCount: PropTypes.number.isRequired,
  onlineUsers: PropTypes.array.isRequired,
  goToUser: PropTypes.func.isRequired
}

export default ToolbarHeader
