import type { ElementType, ReactNode, PropsWithChildren } from 'react'
import type { ButtonProps } from '@/features/ui/components/types/button-props'

type SplitButtonVariants = Extract<
  ButtonProps['variant'],
  'primary' | 'secondary' | 'danger' | 'link'
>

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
  drop?: 'up' | 'up-centered' | 'start' | 'end' | 'down' | 'down-centered'
  focusFirstItemOnShow?: false | true | 'keyboard'
  onKeyDown?: (event: React.KeyboardEvent) => void
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
  download?: boolean | string
  rel?: string
}>

export type DropdownToggleProps = PropsWithChildren<{
  bsPrefix?: string
  className?: string
  disabled?: boolean
  split?: boolean
  id?: string // necessary for assistive technologies
  variant?: SplitButtonVariants
  as?: ElementType
  size?: 'sm' | 'lg' | undefined
  tabIndex?: number
  'aria-label'?: string
  onMouseEnter?: React.MouseEventHandler
}>

export type DropdownMenuProps = PropsWithChildren<{
  as?: ElementType
  disabled?: boolean
  show?: boolean
  className?: string
  flip?: boolean
  id?: string
  renderOnMount?: boolean
}>

export type DropdownDividerProps = PropsWithChildren<{
  as?: ElementType
  className?: string
}>

export type DropdownHeaderProps = PropsWithChildren<{
  as?: ElementType
  className?: string
}>
