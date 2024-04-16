import React from 'react'
import {
  Dropdown as BS5Dropdown,
  DropdownToggle as BS5DropdownToggle,
  DropdownMenu as BS5DropdownMenu,
  DropdownItem as BS5DropdownItem,
  DropdownDivider as BS5DropdownDivider,
} from 'react-bootstrap-5'
import type {
  DropdownProps,
  DropdownItemProps,
  DropdownToggleProps,
  DropdownMenuProps,
} from '@/features/ui/components/types/dropdown-menu-props'
import MaterialIcon from '@/shared/components/material-icon'

export function Dropdown({ ...props }: DropdownProps) {
  return <BS5Dropdown {...props} />
}

export function DropdownItem({
  active,
  children,
  description,
  leadingIcon,
  trailingIcon,
  ...props
}: DropdownItemProps) {
  const trailingIconType = active ? 'check' : trailingIcon
  return (
    <li>
      <BS5DropdownItem
        active={active}
        className={description ? 'dropdown-item-description-container' : ''}
        role="menuitem"
        {...props}
      >
        {leadingIcon && (
          <MaterialIcon
            className="dropdown-item-leading-icon"
            type={leadingIcon}
          />
        )}
        {children}
        {trailingIconType && (
          <MaterialIcon
            className="dropdown-item-trailing-icon"
            type={trailingIconType}
          />
        )}
        {description && (
          <span className="dropdown-item-description">{description}</span>
        )}
      </BS5DropdownItem>
    </li>
  )
}

export function DropdownToggle({ ...props }: DropdownToggleProps) {
  return <BS5DropdownToggle {...props} />
}

export function DropdownMenu({ as = 'ul', ...props }: DropdownMenuProps) {
  return <BS5DropdownMenu as={as} role="menubar" {...props} />
}

export function DropdownDivider() {
  return <BS5DropdownDivider aria-hidden="true" />
}
