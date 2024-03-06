import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import Button from './button'
import type { IconButtonProps } from '@/features/ui/components/types/icon-button-props'
import classNames from 'classnames'

export default function IconButton({
  icon,
  isLoading = false,
  size = 'default',
  ...props
}: IconButtonProps) {
  const { t } = useTranslation()

  const iconButtonClassName = `icon-button-${size}`
  const iconSizeClassName =
    size === 'large'
      ? 'leading-trailing-icon-large'
      : 'leading-trailing-icon-small'
  const materialIconClassName = classNames(iconSizeClassName, {
    'button-content-hidden': isLoading,
  })

  return (
    <Button className={iconButtonClassName} isLoading={isLoading} {...props}>
      <MaterialIcon
        accessibilityLabel={t('add')}
        className={materialIconClassName}
        type={icon}
      />
    </Button>
  )
}
