import React, { useEffect } from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

import OutlineRoot from './outline-root'
import Icon from '../../../shared/components/icon'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import Tooltip from '../../../shared/components/tooltip'

const OutlinePane = React.memo<{
  isTexFile: boolean
  outline: any[]
  jumpToLine(line: number): void
  onToggle(value: boolean): void
  eventTracking: any
  highlightedLine?: number
  show: boolean
  isPartial?: boolean
  expanded?: boolean
  toggleExpanded: () => void
}>(function OutlinePane({
  isTexFile,
  outline,
  jumpToLine,
  onToggle,
  highlightedLine,
  isPartial = false,
  expanded,
  toggleExpanded,
}) {
  const { t } = useTranslation()

  const isOpen = Boolean(isTexFile && expanded)

  useEffect(() => {
    onToggle(isOpen)
  }, [isOpen, onToggle])

  const headerClasses = classNames('outline-pane', {
    'outline-pane-disabled': !isTexFile,
  })

  return (
    <div className={headerClasses}>
      <header className="outline-header">
        <button
          className="outline-header-expand-collapse-btn"
          disabled={!isTexFile}
          onClick={toggleExpanded}
          aria-label={expanded ? t('hide_outline') : t('show_outline')}
        >
          <Icon
            type={isOpen ? 'angle-down' : 'angle-right'}
            className="outline-caret-icon"
          />
          <h4 className="outline-header-name">{t('file_outline')}</h4>
          {isPartial && (
            <Tooltip
              id="partial-outline"
              description={t('partial_outline_warning')}
              overlayProps={{ placement: 'top' }}
            >
              <span role="status">
                <Icon
                  type="exclamation-triangle"
                  aria-label={t('partial_outline_warning')}
                />
              </span>
            </Tooltip>
          )}
        </button>
      </header>
      {isOpen && (
        <div className="outline-body">
          <OutlineRoot
            outline={outline}
            jumpToLine={jumpToLine}
            highlightedLine={highlightedLine}
          />
        </div>
      )}
    </div>
  )
})

export default withErrorBoundary(OutlinePane)
