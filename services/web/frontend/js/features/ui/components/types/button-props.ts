import type { ReactNode } from 'react'

export type ButtonProps = {
  children?: ReactNode
  className?: string
  disabled?: boolean
  form?: string
  leadingIcon?: string
  href?: string
  target?: string
  rel?: string
  isLoading?: boolean
  loadingLabel?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onMouseOver?: React.MouseEventHandler<HTMLButtonElement>
  onMouseOut?: React.MouseEventHandler<HTMLButtonElement>
  onFocus?: React.FocusEventHandler<HTMLButtonElement>
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  size?: 'small' | 'default' | 'large'
  trailingIcon?: string
  type?: 'button' | 'reset' | 'submit'
  variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'danger-ghost'
    | 'premium'
    | 'link'
}
