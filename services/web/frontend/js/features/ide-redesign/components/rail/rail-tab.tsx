import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import classNames from 'classnames'
import { forwardRef, ReactElement } from 'react'
import { NavLink } from 'react-bootstrap'

const RailTab = forwardRef<
  HTMLAnchorElement,
  {
    icon: AvailableUnfilledIcon
    eventKey: string
    open: boolean
    indicator?: ReactElement
    title: string
    disabled?: boolean
  }
>(({ icon, eventKey, open, indicator, title, disabled = false }, ref) => {
  return (
    <OLTooltip
      id={`rail-tab-tooltip-${eventKey}`}
      description={title}
      overlayProps={{ delay: 0, placement: 'right' }}
    >
      <NavLink
        ref={ref}
        eventKey={eventKey}
        className={classNames('ide-rail-tab-link', {
          'open-rail': open,
        })}
        disabled={disabled}
      >
        {open ? (
          <MaterialIcon
            className="ide-rail-tab-link-icon"
            type={icon}
            accessibilityLabel={title}
          />
        ) : (
          <MaterialIcon
            className="ide-rail-tab-link-icon"
            type={icon}
            accessibilityLabel={title}
            unfilled
          />
        )}
        {indicator}
      </NavLink>
    </OLTooltip>
  )
})

RailTab.displayName = 'RailTab'

export default RailTab
