import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import classNames from 'classnames'
import { useTranslation, Trans } from 'react-i18next'

import OutlineRoot from './outline-root'
import Icon from '../../../shared/components/icon'
import localStorage from '../../../infrastructure/local-storage'
import withErrorBoundary from '../../../infrastructure/error-boundary'

function OutlinePane({
  isTexFile,
  outline,
  projectId,
  jumpToLine,
  onToggle,
  eventTracking,
  highlightedLine
}) {
  const { t } = useTranslation()

  const storageKey = `file_outline.expanded.${projectId}`
  const [expanded, setExpanded] = useState(() => {
    const storedExpandedState = localStorage.getItem(storageKey) !== false
    return storedExpandedState
  })
  const isOpen = isTexFile && expanded

  useEffect(
    () => {
      onToggle(isOpen)
    },
    [isOpen]
  )

  const headerClasses = classNames('outline-pane', {
    'outline-pane-disabled': !isTexFile
  })

  function handleExpandCollapseClick() {
    if (isTexFile) {
      localStorage.setItem(storageKey, !expanded)
      eventTracking.sendMB(expanded ? 'outline-collapse' : 'outline-expand')
      setExpanded(!expanded)
    }
  }

  const infoContent = (
    <>
      <Trans
        i18nKey="the_file_outline_is_a_new_feature_click_the_icon_to_learn_more"
        components={[<strong />]}
      />
      .
    </>
  )
  const tooltip = <Tooltip id="outline-info-tooltip">{infoContent}</Tooltip>

  return (
    <div className={headerClasses}>
      <header className="outline-header">
        <button
          className="outline-header-expand-collapse-btn"
          disabled={!isTexFile}
          onClick={handleExpandCollapseClick}
          aria-label={expanded ? t('hide_outline') : t('show_outline')}
        >
          <Icon
            type={isOpen ? 'angle-down' : 'angle-right'}
            classes={{ icon: 'outline-caret-icon' }}
          />
          <h4 className="outline-header-name">{t('file_outline')}</h4>
          {expanded ? (
            <OverlayTrigger placement="top" overlay={tooltip} delayHide={100}>
              <a
                href="/learn/how-to/Using_the_File_Outline_in_Overleaf"
                target="_blank"
                rel="noopener noreferrer"
                className="outline-header-info-badge"
                onClick={ev => ev.stopPropagation()}
              >
                <span className="sr-only">{infoContent}</span>
              </a>
            </OverlayTrigger>
          ) : null}
        </button>
      </header>
      {expanded && isTexFile ? (
        <div className="outline-body">
          <OutlineRoot
            outline={outline}
            jumpToLine={jumpToLine}
            highlightedLine={highlightedLine}
          />
        </div>
      ) : null}
    </div>
  )
}

OutlinePane.propTypes = {
  isTexFile: PropTypes.bool.isRequired,
  outline: PropTypes.array.isRequired,
  projectId: PropTypes.string.isRequired,
  jumpToLine: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  eventTracking: PropTypes.object.isRequired,
  highlightedLine: PropTypes.number
}

export default withErrorBoundary(OutlinePane)
