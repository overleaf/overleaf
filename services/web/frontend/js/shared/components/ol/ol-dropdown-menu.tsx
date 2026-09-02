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
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
  DropdownHeader,
  Button,
} from 'react-bootstrap'
import type {
  OLDropdownProps,
  OLDropdownItemProps,
  OLDropdownToggleProps,
  OLDropdownMenuProps,
  OLDropdownDividerProps,
  OLDropdownHeaderProps,
} from '@/shared/components/types/dropdown-menu-props'
import MaterialIcon from '@/shared/components/material-icon'
import { fixedForwardRef } from '@/utils/react'
import classnames from 'classnames'

// Lets OLDropdownToggle register its presence with the parent OLDropdown so that
// OLDropdownMenu can know whether a toggle exists (and therefore whether Popper
// will run to position the menu).
type DropdownInternalContextValue = {
  registerToggle: () => () => void
  hasToggle: boolean
}
const DropdownInternalContext =
  createContext<DropdownInternalContextValue | null>(null)

export function OLDropdown({ children, ...props }: OLDropdownProps) {
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
      <Dropdown {...props}>{children}</Dropdown>
    </DropdownInternalContext.Provider>
  )
}

function OLDropdownItem(
  {
    active,
    children,
    className,
    description,
    leadingIcon,
    trailingIcon,
    ...props
  }: OLDropdownItemProps,
  ref: React.ForwardedRef<typeof DropdownItem>
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
    <DropdownItem
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
    </DropdownItem>
  )
}

function EmptyLeadingIcon() {
  return <span className="dropdown-item-leading-icon-empty" />
}

const ForwardReferredOLDropdownItem = fixedForwardRef(OLDropdownItem, {
  EmptyLeadingIcon,
})

export { ForwardReferredOLDropdownItem as OLDropdownItem }

export const OLDropdownToggleCustom = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ children, className, ...props }, ref) => (
  <Button
    ref={ref}
    className={classnames('custom-toggle', className)}
    {...props}
  >
    {children}
    <MaterialIcon type="expand_more" />
  </Button>
))
OLDropdownToggleCustom.displayName = 'OLDropdownToggleCustom'

export const OLDropdownToggle = forwardRef<
  HTMLButtonElement,
  OLDropdownToggleProps
>((props, ref) => {
  const registerToggle = useContext(DropdownInternalContext)?.registerToggle

  useLayoutEffect(() => registerToggle?.(), [registerToggle])

  return <DropdownToggle {...props} ref={ref} />
})
OLDropdownToggle.displayName = 'OLDropdownToggle'

export const OLDropdownMenu = forwardRef<
  typeof DropdownMenu,
  OLDropdownMenuProps
>(({ as = 'ul', className, ...props }, ref) => {
  const context = useContext(DropdownInternalContext)

  return (
    <DropdownMenu
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
OLDropdownMenu.displayName = 'OLDropdownMenu'

export function OLDropdownDivider({
  as = 'li',
  ...props
}: OLDropdownDividerProps) {
  return <DropdownDivider as={as} {...props} />
}

export function OLDropdownHeader({
  as = 'li',
  ...props
}: OLDropdownHeaderProps) {
  return <DropdownHeader as={as} {...props} />
}
