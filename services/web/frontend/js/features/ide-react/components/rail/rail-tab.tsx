import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import { ComponentProps, forwardRef, ReactElement } from 'react'
import { NavLink } from 'react-bootstrap'
import { RailElement } from '@/features/ide-react/util/rail-types'

const RailTab = forwardRef<
  HTMLButtonElement,
  {
    icon: RailElement['icon']
    eventKey?: string
    open: boolean
    indicator?: ReactElement
    title: string
  } & ComponentProps<'button'>
>(({ icon, className, eventKey, open, indicator, title, ...props }, ref) => {
  return (
    <OLTooltip
      id={`rail-tab-tooltip-${eventKey}`}
      description={title}
      overlayProps={{ delay: 0, placement: 'right' }}
    >
      <NavLink
        {...props}
        ref={ref}
        eventKey={eventKey}
        className={classNames('ide-rail-tab-link', className, {
          'open-rail': open,
        })}
        as="button"
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
