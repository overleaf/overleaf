import { Button as B5Button, Spinner } from 'react-bootstrap-5'
import type { ButtonProps } from '@/features/ui/components/types/button-props'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

const sizeClasses = new Map<ButtonProps['size'], string>([
  ['small', 'btn-sm'],
  ['default', ''],
  ['large', 'btn-lg'],
])

export default function Button({
  children,
  className,
  isLoading = false,
  size = 'default',
  ...props
}: ButtonProps) {
  const { t } = useTranslation()

  const sizeClass = sizeClasses.get(size)
  const buttonClassName = classNames('d-inline-grid', sizeClass, className, {
    'button-loading': isLoading,
  })
  const loadingSpinnerClassName =
    size === 'large' ? 'loading-spinner-large' : 'loading-spinner-small'

  return (
    <B5Button className={buttonClassName} {...props}>
      {isLoading && (
        <span className="spinner-container">
          <Spinner
            animation="border"
            aria-hidden="true"
            as="span"
            className={loadingSpinnerClassName}
            role="status"
          />
          <span className="sr-only">{t('loading')}</span>
        </span>
      )}
      <span className="button-content" aria-hidden={isLoading}>
        {children}
      </span>
    </B5Button>
  )
}
