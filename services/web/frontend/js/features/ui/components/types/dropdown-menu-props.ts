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
  onSelect?: (eventKey: any, event: object) => any
  onToggle?: (show: boolean) => void
  show?: boolean
}

export type DropdownItemProps = PropsWithChildren<{
  active?: boolean
  as?: ElementType
  description?: string
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
}>

export type DropdownToggleProps = PropsWithChildren<{
  bsPrefix?: string
  disabled?: boolean
  split?: boolean
  id?: string // necessary for assistive technologies
  variant?: SplitButtonVariants
  as?: ElementType
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
}>

export type DropdownHeaderProps = PropsWithChildren<{
  as?: ElementType
}>
