import React, { ReactNode } from 'react'
import {
  Dropdown,
  DropdownMenu,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import DropdownToggleWithTooltip from '@/features/ui/components/bootstrap-5/dropdown-toggle-with-tooltip'

type ActionDropdownProps = {
  id: string
  children: React.ReactNode
  isOpened: boolean
  iconTag: ReactNode
  toolTipDescription: string
  setIsOpened: (isOpened: boolean) => void
}

function ActionsDropdown(props: ActionDropdownProps) {
  const { id, children, isOpened, iconTag, setIsOpened, toolTipDescription } =
    props
  return (
    <Dropdown
      align="end"
      className="float-end"
      show={isOpened}
      onToggle={open => setIsOpened(open)}
    >
      <DropdownToggleWithTooltip
        id={`history-version-dropdown-${id}`}
        className="history-version-dropdown-menu-btn"
        aria-label={toolTipDescription}
        toolTipDescription={toolTipDescription}
        overlayTriggerProps={{ placement: 'bottom' }}
        tooltipProps={{ hidden: isOpened }}
      >
        {iconTag}
      </DropdownToggleWithTooltip>
      <DropdownMenu className="history-version-dropdown-menu">
        {children}
      </DropdownMenu>
    </Dropdown>
  )
}

export default ActionsDropdown
