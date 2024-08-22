import type { ElementType, ReactNode, PropsWithChildren } from 'react'
import type { SplitButtonVariants } from './split-button-props'

export type DropdownProps = {
  align?:
    | 'start'
    | 'end'
    | { sm: 'start' | 'end' }
    | { md: 'start' | 'end' }
    | { lg: 'start' | 'end' }
    | { xl: 'start' | 'end' }
    | { xxl: 'start' | 'end' }
  as?: ElementType
  children: ReactNode
  className?: string
  onSelect?: (eventKey: any, event: object) => any
  onToggle?: (show: boolean) => void
  show?: boolean
  autoClose?: boolean | 'inside' | 'outside'
}

export type DropdownItemProps = PropsWithChildren<{
  active?: boolean
  as?: ElementType
  description?: ReactNode
  disabled?: boolean
  eventKey?: string | number
  href?: string
  leadingIcon?: string | React.ReactNode
  onClick?: React.MouseEventHandler
  trailingIcon?: string | React.ReactNode
  variant?: 'default' | 'danger'
  className?: string
  role?: string
  tabIndex?: number
  target?: string
}>

export type DropdownToggleProps = PropsWithChildren<{
  bsPrefix?: string
  className?: string
  disabled?: boolean
  split?: boolean
  id?: string // necessary for assistive technologies
  variant?: SplitButtonVariants
  as?: ElementType
  size?: 'sm' | 'lg'
}>

export type DropdownMenuProps = PropsWithChildren<{
  as?: ElementType
  disabled?: boolean
  show?: boolean
  className?: string
  flip?: boolean
}>

export type DropdownDividerProps = PropsWithChildren<{
  as?: ElementType
  className?: string
}>

export type DropdownHeaderProps = PropsWithChildren<{
  as?: ElementType
  className?: string
}>
