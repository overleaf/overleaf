import OLButton, { OLButtonProps } from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'

function PrimaryButton({
  children,
  disabled,
  isLoading,
  onClick,
}: OLButtonProps) {
  const { t } = useTranslation()
  return (
    <OLButton
      size="sm"
      disabled={disabled && !isLoading}
      isLoading={isLoading}
      loadingLabel={t('processing')}
      onClick={onClick}
      variant="secondary"
    >
      {children}
    </OLButton>
  )
}

export default PrimaryButton
