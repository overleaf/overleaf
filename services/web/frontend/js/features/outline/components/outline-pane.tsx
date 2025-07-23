import React, { useEffect } from 'react'
import classNames from 'classnames'

import OutlineRoot from './outline-root'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { OutlineToggleButton } from '@/features/outline/components/outline-toggle-button'
import { OutlineItemData } from '@/features/ide-react/types/outline'

const OutlinePane = React.memo<{
  isTexFile: boolean
  outline: OutlineItemData[]
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
        <OutlineToggleButton
          toggleExpanded={toggleExpanded}
          expanded={expanded}
          isOpen={isOpen}
          isPartial={isPartial}
          isTexFile={isTexFile}
        />
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
