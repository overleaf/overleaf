import { PropsWithChildren } from 'react'
import type {
  DropdownItemProps,
  DropdownProps,
  DropdownToggleProps,
} from './dropdown-menu-props'
import type { ButtonProps } from './button-props'

type SplitButtonItemProps = Pick<
  DropdownItemProps,
  'eventKey' | 'leadingIcon'
> & {
  label: React.ReactNode
}

export type SplitButtonVariants = Extract<
  ButtonProps['variant'],
  'primary' | 'secondary' | 'danger'
>

export type SplitButtonProps = PropsWithChildren<{
  align?: DropdownProps['align']
  disabled?: boolean
  id: DropdownToggleProps['id']
  items: SplitButtonItemProps[]
  text: string
  variant: SplitButtonVariants
}>
