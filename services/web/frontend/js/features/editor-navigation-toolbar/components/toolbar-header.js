import React from 'react'
import PropTypes from 'prop-types'
import MenuButton from './menu-button'
import CobrandingLogo from './cobranding-logo'
import BackToProjectsButton from './back-to-projects-button'

function ToolbarHeader({ cobranding, onShowLeftMenuClick }) {
  return (
    <header className="toolbar toolbar-header toolbar-with-labels">
      <div className="toolbar-left">
        <MenuButton onClick={onShowLeftMenuClick} />
        {cobranding ? <CobrandingLogo {...cobranding} /> : null}
        <BackToProjectsButton />
      </div>
    </header>
  )
}

ToolbarHeader.propTypes = {
  onShowLeftMenuClick: PropTypes.func.isRequired,
  cobranding: PropTypes.object
}

export default ToolbarHeader
