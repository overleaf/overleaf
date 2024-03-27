import MaterialIcon from '@/shared/components/material-icon'
import Button from './button'
import type { IconButtonProps } from '@/features/ui/components/types/icon-button-props'
import classNames from 'classnames'

export default function IconButton({
  accessibilityLabel,
  icon,
  isLoading = false,
  size = 'default',
  ...props
}: IconButtonProps) {
  const iconButtonClassName = `icon-button-${size}`
  const iconSizeClassName = size === 'large' ? 'icon-large' : 'icon-small'
  const materialIconClassName = classNames(iconSizeClassName, {
    'button-content-hidden': isLoading,
  })

  return (
    <Button className={iconButtonClassName} isLoading={isLoading} {...props}>
      <MaterialIcon
        accessibilityLabel={accessibilityLabel}
        className={materialIconClassName}
        type={icon}
      />
    </Button>
  )
}
