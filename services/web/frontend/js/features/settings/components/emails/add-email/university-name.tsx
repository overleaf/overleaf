import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'

type UniversityNameProps = {
  name: string
  onClick: () => void
}

function UniversityName({ name, onClick }: UniversityNameProps) {
  const { t } = useTranslation()

  return (
    <p className="pt-1">
      {name}
      <span className="small">
        {' '}
        <Button className="btn-inline-link" onClick={onClick}>
          {t('change')}
        </Button>
      </span>
    </p>
  )
}

export default UniversityName
