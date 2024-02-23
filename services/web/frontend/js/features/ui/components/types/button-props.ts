import type { ReactNode } from 'react'

export type ButtonProps = {
  variant:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'danger-ghost'
    | 'premium'
  size?: 'small' | 'default' | 'large'
  disabled?: boolean
  loading?: boolean
  children: ReactNode
  className?: string
}
