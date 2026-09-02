import { forwardRef } from 'react'
import classNames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from './ol-button'
import type { IconButtonProps } from '@/shared/components/types/icon-button-props'

export type OLIconButtonProps = IconButtonProps

const OLIconButton = forwardRef<HTMLButtonElement, OLIconButtonProps>(
  (
    {
      accessibilityLabel,
      icon,
      isLoading = false,
      loadingLabel,
      size,
      className,
      unfilled,
      ...props
    },
    ref
  ) => {
    const iconButtonClassName = classNames(className, {
      'icon-button': !size,
      'icon-button-small': size === 'sm',
      'icon-button-large': size === 'lg',
    })
    const iconSizeClassName = size === 'lg' ? 'icon-large' : 'icon-small'
    const materialIconClassName = classNames(iconSizeClassName, {
      'button-content-hidden': isLoading,
      unfilled,
    })

    return (
      <OLButton
        className={iconButtonClassName}
        isLoading={isLoading}
        loadingLabel={loadingLabel}
        aria-label={accessibilityLabel}
        {...props}
        ref={ref}
      >
        <MaterialIcon className={materialIconClassName} type={icon} />
      </OLButton>
    )
  }
)
OLIconButton.displayName = 'OLIconButton'

export default OLIconButton
