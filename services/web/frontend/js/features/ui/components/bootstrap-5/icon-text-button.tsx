import MaterialIcon from '@/shared/components/material-icon'
import { IconTextButtonProps } from '../types/icon-text-button-props'
import Button from './button'

export default function IconTextButton({
  children,
  className,
  leadingIcon,
  size = 'default',
  trailingIcon,
  ...props
}: IconTextButtonProps) {
  const materialIconClassName = size === 'large' ? 'icon-large' : 'icon-small'

  return (
    <Button size={size} {...props}>
      {leadingIcon && (
        <MaterialIcon type={leadingIcon} className={materialIconClassName} />
      )}
      {children}
      {trailingIcon && (
        <MaterialIcon type={trailingIcon} className={materialIconClassName} />
      )}
    </Button>
  )
}
