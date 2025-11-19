import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { forwardRef, ReactElement, useCallback } from 'react'
import {
  Dropdown,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { DropdownToggle as BS5DropdownToggle } from 'react-bootstrap'

type RailActionButton = {
  key: string
  icon: AvailableUnfilledIcon
  title: string
  action: () => void
  hide?: boolean
  ref?: React.Ref<HTMLButtonElement>
}

type RailDropdown = {
  key: string
  icon: AvailableUnfilledIcon
  title: string
  dropdown: ReactElement
  hide?: boolean
  ref?: React.Ref<HTMLButtonElement>
}

export type RailAction = RailDropdown | RailActionButton

const RailActionElement = forwardRef<HTMLButtonElement, { action: RailAction }>(
  ({ action }, ref) => {
    const onActionClick = useCallback(() => {
      if ('action' in action) {
        action.action()
      }
    }, [action])

    if (action.hide) {
      return null
    }

    if ('dropdown' in action) {
      return (
        <Dropdown align="end" drop="end">
          <OLTooltip
            id={`rail-dropdown-tooltip-${action.key}`}
            description={action.title}
            overlayProps={{ delay: 0, placement: 'right' }}
          >
            <span>
              <DropdownToggle
                ref={ref as React.ForwardedRef<typeof BS5DropdownToggle>}
                id={`rail-dropdown-btn-${action.key}`}
                className="ide-rail-tab-link ide-rail-tab-button ide-rail-tab-dropdown"
                as="button"
                aria-label={action.title}
              >
                <MaterialIcon
                  className="ide-rail-tab-link-icon"
                  type={action.icon}
                  unfilled
                />
              </DropdownToggle>
            </span>
          </OLTooltip>
          {action.dropdown}
        </Dropdown>
      )
    } else {
      return (
        <OLTooltip
          id={`rail-tab-tooltip-${action.key}`}
          description={action.title}
          overlayProps={{ delay: 0, placement: 'right' }}
        >
          <button
            ref={ref}
            onClick={onActionClick}
            className="ide-rail-tab-link ide-rail-tab-button"
            aria-label={action.title}
          >
            <MaterialIcon
              className="ide-rail-tab-link-icon"
              type={action.icon}
              unfilled
            />
          </button>
        </OLTooltip>
      )
    }
  }
)

RailActionElement.displayName = 'RailActionElement'

export default RailActionElement
