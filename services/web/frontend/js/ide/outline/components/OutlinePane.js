import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import classNames from 'classnames'
import OutlineRoot from './OutlineRoot'

function OutlinePane({ isTexFile, outline, jumpToLine }) {
  const [expanded, setExpanded] = useState(true)

  const expandCollapseIconClasses = classNames('fa', 'outline-caret-icon', {
    'fa-angle-down': expanded,
    'fa-angle-right': !expanded
  })

  const headerClasses = classNames('outline-pane', {
    'outline-pane-disabled': !isTexFile
  })

  function handleExpandCollapseClick() {
    if (isTexFile) {
      setExpanded(!expanded)
    }
  }

  return (
    <div className={headerClasses}>
      <header className="outline-header">
        <button
          className="outline-header-expand-collapse-btn"
          disabled={!isTexFile}
          onClick={handleExpandCollapseClick}
        >
          <i className={expandCollapseIconClasses} />
          <h4 className="outline-header-name">File outline</h4>
        </button>
        <OverlayTrigger placement="top" overlay={tooltip} delayHide={100}>
          <a
            href="/beta/participate"
            target="_blank"
            rel="noopener noreferrer"
            className="outline-header-beta-badge"
          >
            <span className="sr-only">
              The File outline is a beta feature. Click here to manage your beta
              program membership.
            </span>
          </a>
        </OverlayTrigger>
      </header>
      {expanded && isTexFile ? (
        <div className="outline-body">
          <OutlineRoot outline={outline} jumpToLine={jumpToLine} />
        </div>
      ) : null}
    </div>
  )
}

const tooltip = (
  <Tooltip id="outline-beta-badge-tooltip">
    The <strong>File outline</strong> is a beta feature.
  </Tooltip>
)

OutlinePane.propTypes = {
  isTexFile: PropTypes.bool.isRequired,
  outline: PropTypes.array.isRequired,
  jumpToLine: PropTypes.func.isRequired
}

export default OutlinePane
