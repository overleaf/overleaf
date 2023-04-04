import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'

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
        <Button className="btn-inline-link" onClick={onClick} bsStyle={null}>
          {t('change')}
        </Button>
      </span>
    </p>
  )
}

export default UniversityName
