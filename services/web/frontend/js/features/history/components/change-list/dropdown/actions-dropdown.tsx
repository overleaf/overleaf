import React, { ReactNode } from 'react'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

type ActionDropdownProps = {
  id: string
  children: React.ReactNode
  isOpened: boolean
  iconTag: ReactNode
  tooltipDescription: string
  setIsOpened: (isOpened: boolean) => void
}

function ActionsDropdown(props: ActionDropdownProps) {
  const { id, children, isOpened, iconTag, setIsOpened, tooltipDescription } =
    props
  return (
    <Dropdown
      align="end"
      className="float-end"
      show={isOpened}
      onToggle={open => setIsOpened(open)}
    >
      <OLTooltip
        id={`history-version-dropdown-${id}`}
        description={tooltipDescription}
        overlayProps={{ placement: 'bottom' }}
        hidden={isOpened}
      >
        {/* OverlayTrigger won't fire unless the child is a non-react html element (e.g div, span) */}
        <span>
          <DropdownToggle
            id={`history-version-dropdown-toggle-${id}`}
            className="history-version-dropdown-menu-btn"
            as="button"
          >
            {iconTag}
          </DropdownToggle>
        </span>
      </OLTooltip>
      <DropdownMenu className="history-version-dropdown-menu">
        {children}
      </DropdownMenu>
    </Dropdown>
  )
}

export default ActionsDropdown
