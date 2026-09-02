import type { ElementType, ReactNode, PropsWithChildren, AriaRole } from 'react'
import type { ButtonProps } from '@/shared/components/types/button-props'
import type { DropdownMenuProps } from 'react-bootstrap'

type SplitButtonVariants = Extract<
  ButtonProps['variant'],
  'primary' | 'secondary' | 'danger' | 'link' | 'ghost'
>

export type OLDropdownProps = {
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
  role?: AriaRole
}

export type OLDropdownItemProps = PropsWithChildren<
  {
    active?: boolean
    as?: ElementType
    type?: string
    description?: ReactNode
    disabled?: boolean
    eventKey?: string | number
    href?: string
    leadingIcon?: string | React.ReactNode
    onClick?: React.MouseEventHandler
    onMouseEnter?: React.MouseEventHandler
    trailingIcon?: string | React.ReactNode
    variant?: 'default' | 'danger'
    className?: string
    role?: string
    form?: string
    tabIndex?: number
    target?: string
    download?: boolean | string
    rel?: string
    translate?: React.HTMLAttributes<HTMLElement>['translate']
  } & React.AriaAttributes & { [key: `data-${string}`]: unknown }
>

export type OLDropdownToggleProps = PropsWithChildren<
  {
    bsPrefix?: string
    className?: string
    disabled?: boolean
    split?: boolean
    id?: string // necessary for assistive technologies
    variant?: SplitButtonVariants
    as?: ElementType
    size?: 'sm' | 'lg' | undefined
    tabIndex?: number
    role?: string
    onMouseEnter?: React.MouseEventHandler
  } & React.AriaAttributes & { [key: `data-${string}`]: unknown }
>

export type OLDropdownMenuProps = PropsWithChildren<
  {
    as?: ElementType
    disabled?: boolean
    show?: boolean
    className?: string
    flip?: boolean
    id?: string
    renderOnMount?: boolean
    popperConfig?: DropdownMenuProps['popperConfig']
    tabIndex?: number
    onKeyDown?: (event: React.KeyboardEvent) => void
  } & React.AriaAttributes
>

export type OLDropdownDividerProps = PropsWithChildren<{
  as?: ElementType
  className?: string
}>

export type OLDropdownHeaderProps = PropsWithChildren<{
  as?: ElementType
  className?: string
}>
