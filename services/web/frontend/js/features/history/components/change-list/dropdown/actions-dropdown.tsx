import React, { useRef, useEffect, ReactNode } from 'react'
import { Dropdown as BS3Dropdown } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import {
  Dropdown,
  DropdownMenu,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BS3DropdownToggleWithTooltip from '../../../../ui/components/bootstrap-3/dropdown-toggle-with-tooltip'
import BS5DropdownToggleWithTooltip from '@/features/ui/components/bootstrap-5/dropdown-toggle-with-tooltip'
import DropdownMenuWithRef from '../../../../ui/components/bootstrap-3/dropdown-menu-with-ref'

type ActionDropdownProps = {
  id: string
  children: React.ReactNode
  parentSelector?: string
  isOpened: boolean
  iconTag: ReactNode
  toolTipDescription: string
  setIsOpened: (isOpened: boolean) => void
}

function BS3ActionsDropdown({
  id,
  children,
  parentSelector,
  isOpened,
  iconTag,
  setIsOpened,
  toolTipDescription,
}: ActionDropdownProps) {
  const menuRef = useRef<HTMLElement>()

  // handle the placement of the dropdown above or below the toggle button
  useEffect(() => {
    if (menuRef.current && parentSelector) {
      const parent = menuRef.current.closest(parentSelector)

      if (!parent) {
        return
      }

      const parentBottom = parent.getBoundingClientRect().bottom
      const { top, height } = menuRef.current.getBoundingClientRect()

      if (top + height > parentBottom) {
        menuRef.current.style.bottom = '100%'
        menuRef.current.style.top = 'auto'
      } else {
        menuRef.current.style.bottom = 'auto'
        menuRef.current.style.top = '100%'
      }
    }
  })

  return (
    <BS3Dropdown
      id={`history-version-dropdown-${id}`}
      pullRight
      open={isOpened}
      onToggle={open => setIsOpened(open)}
      className="pull-right"
    >
      <BS3DropdownToggleWithTooltip
        bsRole="toggle"
        className="history-version-dropdown-menu-btn"
        isOpened={isOpened}
        tooltipProps={{
          id,
          description: toolTipDescription,
          overlayProps: { placement: 'bottom', trigger: ['hover'] },
        }}
      >
        {iconTag}
      </BS3DropdownToggleWithTooltip>
      <DropdownMenuWithRef
        bsRole="menu"
        className="history-version-dropdown-menu"
        menuRef={menuRef}
      >
        {children}
      </DropdownMenuWithRef>
    </BS3Dropdown>
  )
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
  return (
    <BootstrapVersionSwitcher
      bs3={<BS3ActionsDropdown {...props} />}
      bs5={<BS5ActionsDropdown {...props} />}
    />
  )
}

export default ActionsDropdown
