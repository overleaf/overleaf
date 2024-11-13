import type { ReactNode } from 'react'

export type ButtonProps = {
  children?: ReactNode
  className?: string
  disabled?: boolean
  download?: boolean | string
  draggable?: boolean
  form?: string
  leadingIcon?: string | React.ReactNode
  href?: string
  id?: string
  target?: string
  rel?: string
  isLoading?: boolean
  loadingLabel?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>
  onMouseOver?: React.MouseEventHandler<HTMLButtonElement>
  onMouseOut?: React.MouseEventHandler<HTMLButtonElement>
  onFocus?: React.FocusEventHandler<HTMLButtonElement>
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  size?: 'sm' | 'lg' | undefined
  style?: Record<PropertyKey, string>
  active?: boolean
  trailingIcon?: string | React.ReactNode
  type?: 'button' | 'reset' | 'submit'
  variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'danger-ghost'
    | 'premium'
    | 'premium-secondary'
    | 'link'
}
