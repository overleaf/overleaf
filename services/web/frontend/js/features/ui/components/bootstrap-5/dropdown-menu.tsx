import React, { forwardRef } from 'react'
import {
  Dropdown as BS5Dropdown,
  DropdownToggle as BS5DropdownToggle,
  DropdownMenu as BS5DropdownMenu,
  DropdownItem as BS5DropdownItem,
  DropdownDivider as BS5DropdownDivider,
  DropdownHeader as BS5DropdownHeader,
} from 'react-bootstrap-5'
import type {
  DropdownProps,
  DropdownItemProps,
  DropdownToggleProps,
  DropdownMenuProps,
  DropdownDividerProps,
  DropdownHeaderProps,
} from '@/features/ui/components/types/dropdown-menu-props'
import MaterialIcon from '@/shared/components/material-icon'
import { fixedForwardRef } from '@/utils/react'

export function Dropdown({ ...props }: DropdownProps) {
  return <BS5Dropdown {...props} />
}

function DropdownItem(
  {
    active,
    children,
    description,
    leadingIcon,
    trailingIcon,
    ...props
  }: DropdownItemProps,
  ref: React.ForwardedRef<typeof BS5DropdownItem>
) {
  let leadingIconComponent = null
  if (leadingIcon) {
    if (typeof leadingIcon === 'string') {
      leadingIconComponent = (
        <MaterialIcon
          className="dropdown-item-leading-icon"
          type={leadingIcon}
        />
      )
    } else {
      leadingIconComponent = (
        <span className="dropdown-item-leading-icon" aria-hidden="true">
          {leadingIcon}
        </span>
      )
    }
  }

  let trailingIconComponent = null
  if (trailingIcon) {
    if (typeof trailingIcon === 'string') {
      const trailingIconType = active ? 'check' : trailingIcon

      trailingIconComponent = (
        <MaterialIcon
          className="dropdown-item-trailing-icon"
          type={trailingIconType}
        />
      )
    } else {
      trailingIconComponent = (
        <span className="dropdown-item-trailing-icon" aria-hidden="true">
          {trailingIcon}
        </span>
      )
    }
  }

  return (
    <BS5DropdownItem
      active={active}
      className={description ? 'dropdown-item-description-container' : ''}
      role="menuitem"
      {...props}
      ref={ref}
    >
      {leadingIconComponent}
      {children}
      {trailingIconComponent}
      {description && (
        <span className="dropdown-item-description">{description}</span>
      )}
    </BS5DropdownItem>
  )
}

function EmptyLeadingIcon() {
  return <span className="dropdown-item-leading-icon-empty" />
}

const ForwardReferredDropdownItem = fixedForwardRef(DropdownItem, {
  EmptyLeadingIcon,
})

export { ForwardReferredDropdownItem as DropdownItem }

export function DropdownToggle({ ...props }: DropdownToggleProps) {
  return <BS5DropdownToggle {...props} />
}

export const DropdownMenu = forwardRef<
  typeof BS5DropdownMenu,
  DropdownMenuProps
>(({ as = 'ul', ...props }, ref) => {
  return <BS5DropdownMenu as={as} role="menu" {...props} ref={ref} />
})
DropdownMenu.displayName = 'DropdownMenu'

export function DropdownDivider({ as = 'li', ...props }: DropdownDividerProps) {
  return <BS5DropdownDivider as={as} {...props} />
}

export function DropdownHeader({ as = 'li', ...props }: DropdownHeaderProps) {
  return <BS5DropdownHeader as={as} {...props} />
}
