import { useTranslation } from 'react-i18next'
import ButtonWrapper from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

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
        <ButtonWrapper
          variant="link"
          onClick={onClick}
          bs3Props={{ bsStyle: null, className: 'btn-inline-link' }}
        >
          {t('change')}
        </ButtonWrapper>
      </span>
    </p>
  )
}

export default UniversityName
