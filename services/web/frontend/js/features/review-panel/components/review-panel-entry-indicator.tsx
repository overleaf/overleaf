import { memo, MouseEventHandler } from 'react'
import MaterialIcon from '@/shared/components/material-icon'

export const EntryIndicator = memo<{
  handleMouseEnter?: MouseEventHandler<HTMLDivElement>
  handleMouseLeave?: MouseEventHandler<HTMLDivElement>
  handleMouseDown?: MouseEventHandler<HTMLDivElement>
  type: string
}>(function EntryIndicator({
  handleMouseEnter,
  handleMouseLeave,
  handleMouseDown,
  type,
}) {
  return (
    <div
      className="review-panel-entry-indicator"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown} // Using onMouseDown rather than onClick to guarantee that it fires before onFocus
      role="button"
      tabIndex={0}
    >
      <MaterialIcon type={type} className="review-panel-entry-icon" />
    </div>
  )
})
