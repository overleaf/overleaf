import type { MouseEventHandler, ReactNode } from 'react'

export type ButtonProps = {
  children?: ReactNode
  className?: string
  disabled?: boolean
  form?: string
  leadingIcon?: string
  href?: string
  isLoading?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
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
}
