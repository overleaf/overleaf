import type { MouseEventHandler, ReactNode } from 'react'

export type ButtonProps = {
  children?: ReactNode
  className?: string
  disabled?: boolean
  href?: string
  isLoading?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  size?: 'small' | 'default' | 'large'
  type?: 'button' | 'reset' | 'submit'
  variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'danger-ghost'
    | 'premium'
}
