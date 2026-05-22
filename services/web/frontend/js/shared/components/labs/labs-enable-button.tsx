import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'

type LabsEnableButtonProps = {
  optedIn: boolean
  disabled: boolean
  loading?: boolean
  ghost?: boolean
  handleEnable: () => void
  handleDisable: () => void
}

export function LabsEnableButton({
  optedIn,
  disabled,
  loading,
  ghost,
  handleEnable,
  handleDisable,
}: LabsEnableButtonProps) {
  const { t } = useTranslation()
  const isDisabled = loading || disabled

  if (optedIn) {
    return (
      <OLButton
        variant={ghost ? 'danger-ghost' : 'secondary'}
        onClick={handleDisable}
        disabled={isDisabled}
      >
        {t('disable')}
      </OLButton>
    )
  }

  return (
    <OLButton
      variant={ghost ? 'secondary' : 'primary'}
      onClick={handleEnable}
      disabled={isDisabled}
    >
      {t('enable')}
    </OLButton>
  )
}
