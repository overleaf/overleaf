import { useTranslation } from 'react-i18next'
import OLButton, { OLButtonProps } from '@/shared/components/ol/ol-button'

function EmailAffiliatedWithInstitution({ onClick, ...props }: OLButtonProps) {
  const { t } = useTranslation()

  return (
    <div className="mt-1">
      {t('is_email_affiliated')}
      <OLButton
        variant="link"
        onClick={onClick}
        className="btn-inline-link"
        {...props}
      >
        {t('let_us_know')}
      </OLButton>
    </div>
  )
}

export default EmailAffiliatedWithInstitution
