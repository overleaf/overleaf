import React from 'react'
import {
  Dropdown as B5Dropdown,
  DropdownToggle as B5DropdownToggle,
  DropdownMenu as B5DropdownMenu,
  DropdownItem as B5DropdownItem,
  DropdownDivider as B5DropdownDivider,
} from 'react-bootstrap-5'
import type {
  DropdownProps,
  DropdownItemProps,
  DropdownToggleProps,
  DropdownMenuProps,
} from '@/features/ui/components/types/dropdown-menu-props'
import MaterialIcon from '@/shared/components/material-icon'

export function Dropdown({ ...props }: DropdownProps) {
  return <B5Dropdown {...props} />
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
      <B5DropdownItem
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
      </B5DropdownItem>
    </li>
  )
}

export function DropdownToggle({ ...props }: DropdownToggleProps) {
  return <B5DropdownToggle {...props} />
}

export function DropdownMenu({ as = 'ul', ...props }: DropdownMenuProps) {
  return <B5DropdownMenu as={as} role="menubar" {...props} />
}

export function DropdownDivider() {
  return <B5DropdownDivider aria-hidden="true" />
}
