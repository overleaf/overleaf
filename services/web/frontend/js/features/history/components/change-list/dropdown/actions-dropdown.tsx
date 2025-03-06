import React, { ReactNode } from 'react'
import {
  Dropdown,
  DropdownMenu,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BS5DropdownToggleWithTooltip from '@/features/ui/components/bootstrap-5/dropdown-toggle-with-tooltip'

type ActionDropdownProps = {
  id: string
  children: React.ReactNode
  parentSelector?: string
  isOpened: boolean
  iconTag: ReactNode
  toolTipDescription: string
  setIsOpened: (isOpened: boolean) => void
}

function BS5ActionsDropdown({
  id,
  children,
  isOpened,
  iconTag,
  setIsOpened,
  toolTipDescription,
}: Omit<ActionDropdownProps, 'parentSelector'>) {
  return (
    <Dropdown
      align="end"
      className="float-end"
      show={isOpened}
      onToggle={open => setIsOpened(open)}
    >
      <BS5DropdownToggleWithTooltip
        id={`history-version-dropdown-${id}`}
        className="history-version-dropdown-menu-btn"
        aria-label={toolTipDescription}
        toolTipDescription={toolTipDescription}
        overlayTriggerProps={{ placement: 'bottom' }}
        tooltipProps={{ hidden: isOpened }}
      >
        {iconTag}
      </BS5DropdownToggleWithTooltip>
      <DropdownMenu className="history-version-dropdown-menu">
        {children}
      </DropdownMenu>
    </Dropdown>
  )
}

function ActionsDropdown(props: ActionDropdownProps) {
  return <BS5ActionsDropdown {...props} />
}

export default ActionsDropdown
