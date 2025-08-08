import React, { forwardRef } from 'react'
import {
  Dropdown as BS5Dropdown,
  DropdownToggle as BS5DropdownToggle,
  DropdownMenu as BS5DropdownMenu,
  DropdownItem as BS5DropdownItem,
  DropdownDivider as BS5DropdownDivider,
  DropdownHeader as BS5DropdownHeader,
  Button as BS5Button,
} from 'react-bootstrap'
import type {
  DropdownProps,
  DropdownItemProps,
  DropdownToggleProps,
  DropdownMenuProps,
  DropdownDividerProps,
  DropdownHeaderProps,
} from '@/shared/components/types/dropdown-menu-props'
import MaterialIcon from '@/shared/components/material-icon'
import { fixedForwardRef } from '@/utils/react'
import classnames from 'classnames'

export function Dropdown({ ...props }: DropdownProps) {
  return <BS5Dropdown {...props} />
}

function DropdownItem(
  {
    active,
    children,
    className,
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
      className={className}
      role="menuitem"
      {...props}
      ref={ref}
    >
      {leadingIconComponent}
      <div
        className={classnames({
          'dropdown-item-description-container': description,
        })}
      >
        {children}
        {trailingIconComponent}
        {description && (
          <span className="dropdown-item-description">{description}</span>
        )}
      </div>
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

export const DropdownToggleCustom = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof BS5Button>
>(({ children, className, ...props }, ref) => (
  <BS5Button
    ref={ref}
    className={classnames('custom-toggle', className)}
    {...props}
  >
    {children}
    <MaterialIcon type="expand_more" />
  </BS5Button>
))
DropdownToggleCustom.displayName = 'DropdownToggleCustom'

export const DropdownToggle = forwardRef<
  typeof BS5DropdownToggle,
  DropdownToggleProps
>((props, ref) => <BS5DropdownToggle {...props} ref={ref} />)
DropdownToggle.displayName = 'DropdownToggle'

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
