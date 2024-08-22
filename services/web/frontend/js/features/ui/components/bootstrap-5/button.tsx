import { forwardRef } from 'react'
import { Button as BS5Button, Spinner } from 'react-bootstrap-5'
import type { ButtonProps } from '@/features/ui/components/types/button-props'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

const sizeClasses = new Map<ButtonProps['size'], string>([
  ['small', 'btn-sm'],
  ['default', ''],
  ['large', 'btn-lg'],
])

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      leadingIcon,
      isLoading = false,
      loadingLabel,
      size = 'default',
      trailingIcon,
      variant = 'primary',
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation()

    const sizeClass = sizeClasses.get(size)
    const buttonClassName = classNames('d-inline-grid', sizeClass, className, {
      'button-loading': isLoading,
    })
    const loadingSpinnerClassName =
      size === 'large' ? 'loading-spinner-large' : 'loading-spinner-small'
    const materialIconClassName = size === 'large' ? 'icon-large' : 'icon-small'

    return (
      <BS5Button
        className={buttonClassName}
        variant={variant}
        {...props}
        ref={ref}
      >
        {isLoading && (
          <span className="spinner-container">
            <Spinner
              animation="border"
              aria-hidden="true"
              as="span"
              className={loadingSpinnerClassName}
              role="status"
            />
            <span className="visually-hidden">
              {loadingLabel ?? t('loading')}
            </span>
          </span>
        )}
        <span className="button-content" aria-hidden={isLoading}>
          {leadingIcon && (
            <MaterialIcon
              type={leadingIcon}
              className={materialIconClassName}
            />
          )}
          {children}
          {trailingIcon && (
            <MaterialIcon
              type={trailingIcon}
              className={materialIconClassName}
            />
          )}
        </span>
      </BS5Button>
    )
  }
)
Button.displayName = 'Button'

export default Button
