import { useTranslation } from 'react-i18next'
import ButtonWrapper, {
  ButtonWrapperProps,
} from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

function EmailAffiliatedWithInstitution({
  onClick,
  ...props
}: ButtonWrapperProps) {
  const { t } = useTranslation()

  return (
    <div className="mt-1">
      {t('is_email_affiliated')}
      <ButtonWrapper
        variant="link"
        onClick={onClick}
        bs3Props={{ bsStyle: null, className: 'btn-inline-link' }}
        {...props}
      >
        {t('let_us_know')}
      </ButtonWrapper>
    </div>
  )
}

export default EmailAffiliatedWithInstitution
