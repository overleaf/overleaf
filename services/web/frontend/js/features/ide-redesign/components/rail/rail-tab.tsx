import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import { forwardRef, ReactElement } from 'react'
import { NavLink } from 'react-bootstrap'
import { RailElement } from '../../utils/rail-types'

const RailTab = forwardRef<
  HTMLAnchorElement,
  {
    icon: RailElement['icon']
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
        <RailTabIcon icon={icon} title={title} open={open} />
        {indicator}
      </NavLink>
    </OLTooltip>
  )
})

const RailTabIcon = ({
  icon,
  title,
  open,
}: {
  icon: RailElement['icon']
  title: string
  open: boolean
}) => {
  if (typeof icon === 'string') {
    return open ? (
      <MaterialIcon
        type={icon}
        className="ide-rail-tab-link-icon"
        accessibilityLabel={title}
      />
    ) : (
      <MaterialIcon
        type={icon}
        className="ide-rail-tab-link-icon"
        unfilled
        accessibilityLabel={title}
      />
    )
  } else {
    const Component = icon
    return <Component open={open} title={title} />
  }
}

RailTab.displayName = 'RailTab'

export default RailTab
