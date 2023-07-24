import classnames from 'classnames'
import { forwardRef } from 'react'

type EntryIndicatorProps = {
  focused: boolean
  onMouseEnter: () => void
  onClick: () => void
  children: React.ReactNode
}

const EntryIndicator = forwardRef<HTMLDivElement, EntryIndicatorProps>(
  ({ focused, onMouseEnter, onClick, children }, ref) => {
    return (
      /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
      <div
        ref={ref}
        className={classnames('rp-entry-indicator', {
          'rp-entry-indicator-focused': focused,
        })}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
      >
        {children}
      </div>
    )
  }
)
EntryIndicator.displayName = 'EntryIndicator'

export default EntryIndicator
