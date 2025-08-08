import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'

type UniversityNameProps = {
  name: string
  onClick: () => void
}

function UniversityName({ name, onClick }: UniversityNameProps) {
  const { t } = useTranslation()

  return (
    <p>
      {name}
      <span className="small">
        {' '}
        <OLButton variant="link" onClick={onClick} className="btn-inline-link">
          {t('change')}
        </OLButton>
      </span>
    </p>
  )
}

export default UniversityName
