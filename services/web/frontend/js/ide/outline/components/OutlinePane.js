import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import classNames from 'classnames'
import OutlineRoot from './OutlineRoot'
import localStorage from '../../../modules/localStorage'

function OutlinePane({ isTexFile, outline, projectId, jumpToLine, onToggle }) {
  const storageKey = `file_outline.expanded.${projectId}`
  const [expanded, setExpanded] = useState(() => {
    const storedExpandedState = localStorage(storageKey) !== false
    return storedExpandedState
  })
  const isOpen = isTexFile && expanded

  useEffect(
    () => {
      onToggle(isOpen)
    },
    [isOpen]
  )

  const expandCollapseIconClasses = classNames('fa', 'outline-caret-icon', {
    'fa-angle-down': isOpen,
    'fa-angle-right': !isOpen
  })

  const headerClasses = classNames('outline-pane', {
    'outline-pane-disabled': !isTexFile
  })

  function handleExpandCollapseClick() {
    if (isTexFile) {
      localStorage(storageKey, !expanded)
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
          <OverlayTrigger placement="top" overlay={tooltip} delayHide={100}>
            <a
              href="/beta/participate"
              target="_blank"
              rel="noopener noreferrer"
              className="outline-header-beta-badge"
            >
              <span className="sr-only">
                The File outline is a beta feature. Click here to manage your
                beta program membership.
              </span>
            </a>
          </OverlayTrigger>
        </button>
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
  projectId: PropTypes.string.isRequired,
  jumpToLine: PropTypes.func.isRequired,
  onToggle: PropTypes.func
}

export default OutlinePane
