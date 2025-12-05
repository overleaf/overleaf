import { forwardRef, ReactNode } from 'react'
import { Button, ButtonProps, Spinner } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

type DSButtonProps = Pick<
  ButtonProps,
  | 'children'
  | 'className'
  | 'disabled'
  | 'href'
  | 'id'
  | 'target'
  | 'rel'
  | 'onClick'
  | 'onMouseDown'
  | 'onMouseOver'
  | 'onMouseOut'
  | 'onFocus'
  | 'onBlur'
  | 'size'
  | 'active'
  | 'type'
> & {
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger'
  isLoading?: boolean
  loadingLabel?: string
}

const DSButton = forwardRef<HTMLButtonElement, DSButtonProps>(
  (
    {
      children,
      className,
      leadingIcon,
      isLoading = false,
      loadingLabel,
      trailingIcon,
      variant = 'primary',
      size,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation()

    const buttonClassName = classNames('d-inline-grid btn-ds', className, {
      'button-loading': isLoading,
    })

    const loadingSpinnerClassName =
      size === 'lg' ? 'loading-spinner-large' : 'loading-spinner-small'

    return (
      <Button
        className={buttonClassName}
        variant={variant}
        size={size}
        {...props}
        ref={ref}
        disabled={isLoading || props.disabled}
        data-ol-loading={isLoading}
        role={undefined}
      >
        {isLoading && (
          <span className="spinner-container">
            <Spinner
              size="sm"
              animation="border"
              aria-hidden="true"
              className={loadingSpinnerClassName}
            />
            <span className="visually-hidden">
              {loadingLabel ?? t('loading')}
            </span>
          </span>
        )}
        <span className="button-content" aria-hidden={isLoading}>
          {leadingIcon}
          {children}
          {trailingIcon}
        </span>
      </Button>
    )
  }
)

DSButton.displayName = 'DSButton'

export default DSButton
