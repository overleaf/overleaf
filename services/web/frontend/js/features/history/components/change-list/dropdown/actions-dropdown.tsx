import { useRef, useEffect, ReactNode } from 'react'
import { Dropdown } from 'react-bootstrap'
import DropdownToggleWithTooltip from '../../../../../shared/components/dropdown/dropdown-toggle-with-tooltip'
import DropdownMenuWithRef from '../../../../../shared/components/dropdown/dropdown-menu-with-ref'

type DropdownMenuProps = {
  id: string
  children: React.ReactNode
  parentSelector?: string
  isOpened: boolean
  iconTag: ReactNode
  toolTipDescription: string
  setIsOpened: (isOpened: boolean) => void
}

function ActionsDropdown({
  id,
  children,
  parentSelector,
  isOpened,
  iconTag,
  setIsOpened,
  toolTipDescription,
}: DropdownMenuProps) {
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
    <Dropdown
      id={`history-version-dropdown-${id}`}
      pullRight
      open={isOpened}
      onToggle={open => setIsOpened(open)}
      className="pull-right"
    >
      <DropdownToggleWithTooltip
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
      </DropdownToggleWithTooltip>
      <DropdownMenuWithRef
        bsRole="menu"
        className="history-version-dropdown-menu"
        menuRef={menuRef}
      >
        {children}
      </DropdownMenuWithRef>
    </Dropdown>
  )
}

export default ActionsDropdown
