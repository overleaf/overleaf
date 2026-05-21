import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
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

// Lets DropdownToggle register its presence with the parent Dropdown so that
// DropdownMenu can know whether a toggle exists (and therefore whether Popper
// will run to position the menu).
type DropdownInternalContextValue = {
  registerToggle: () => () => void
  hasToggle: boolean
}
const DropdownInternalContext =
  createContext<DropdownInternalContextValue | null>(null)

export function Dropdown({ children, ...props }: DropdownProps) {
  const [toggleCount, setToggleCount] = useState(0)

  const registerToggle = useCallback(() => {
    setToggleCount(c => c + 1)
    return () => setToggleCount(c => c - 1)
  }, [])

  const value = useMemo(
    () => ({ registerToggle, hasToggle: toggleCount > 0 }),
    [registerToggle, toggleCount]
  )

  return (
    <DropdownInternalContext.Provider value={value}>
      <BS5Dropdown {...props}>{children}</BS5Dropdown>
    </DropdownInternalContext.Provider>
  )
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
      {description ? (
        <span className="dropdown-item-description-container">
          {children}
          <span className="dropdown-item-description">{description}</span>
        </span>
      ) : (
        children
      )}
      {trailingIconComponent}
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
>((props, ref) => {
  const registerToggle = useContext(DropdownInternalContext)?.registerToggle

  useLayoutEffect(() => registerToggle?.(), [registerToggle])

  return <BS5DropdownToggle {...props} ref={ref} />
})
DropdownToggle.displayName = 'DropdownToggle'

export const DropdownMenu = forwardRef<
  typeof BS5DropdownMenu,
  DropdownMenuProps
>(({ as = 'ul', className, ...props }, ref) => {
  const context = useContext(DropdownInternalContext)

  return (
    <BS5DropdownMenu
      as={as}
      role="menu"
      className={classnames(className, {
        'dropdown-menu-popper': !!context?.hasToggle,
      })}
      {...props}
      ref={ref}
    />
  )
})
DropdownMenu.displayName = 'DropdownMenu'

export function DropdownDivider({ as = 'li', ...props }: DropdownDividerProps) {
  return <BS5DropdownDivider as={as} {...props} />
}

export function DropdownHeader({ as = 'li', ...props }: DropdownHeaderProps) {
  return <BS5DropdownHeader as={as} {...props} />
}
