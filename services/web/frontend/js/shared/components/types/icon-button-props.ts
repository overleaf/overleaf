import { AvailableUnfilledIcon } from '@/shared/components/material-icon'
import { ButtonProps } from './button-props'

type BaseIconButtonProps = ButtonProps & {
  accessibilityLabel?: string
  type?: 'button' | 'submit' | 'reset'
}

type FilledIconButtonProps = BaseIconButtonProps & {
  icon: string
  unfilled?: false
}

type UnfilledIconButtonProps = BaseIconButtonProps & {
  icon: AvailableUnfilledIcon
  unfilled: true
}

export type IconButtonProps = FilledIconButtonProps | UnfilledIconButtonProps
