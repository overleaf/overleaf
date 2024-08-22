import { forwardRef } from 'react'
import classNames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import Button from './button'
import type { IconButtonProps } from '@/features/ui/components/types/icon-button-props'

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { accessibilityLabel, icon, isLoading = false, size = 'default', ...props },
    ref
  ) => {
    const iconButtonClassName = `icon-button-${size}`
    const iconSizeClassName = size === 'large' ? 'icon-large' : 'icon-small'
    const materialIconClassName = classNames(iconSizeClassName, {
      'button-content-hidden': isLoading,
    })

    return (
      <Button
        className={iconButtonClassName}
        isLoading={isLoading}
        aria-label={accessibilityLabel}
        {...props}
        ref={ref}
      >
        <MaterialIcon className={materialIconClassName} type={icon} />
      </Button>
    )
  }
)
IconButton.displayName = 'IconButton'

export default IconButton
