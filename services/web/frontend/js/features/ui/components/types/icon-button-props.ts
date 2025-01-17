import { ButtonProps } from './button-props'

export type IconButtonProps = ButtonProps & {
  accessibilityLabel?: string
  icon: string
  type?: 'button' | 'submit'
}
