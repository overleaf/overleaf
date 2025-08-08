import { useTranslation } from 'react-i18next'
import OLButton, { OLButtonProps } from '@/shared/components/ol/ol-button'

function AddAnotherEmailBtn({ onClick, ...props }: OLButtonProps) {
  const { t } = useTranslation()

  return (
    <OLButton
      variant="link"
      onClick={onClick}
      className="btn-inline-link"
      {...props}
    >
      {t('add_another_email')}
    </OLButton>
  )
}

export default AddAnotherEmailBtn
