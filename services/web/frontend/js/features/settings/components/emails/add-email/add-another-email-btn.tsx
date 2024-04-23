import { useTranslation } from 'react-i18next'
import ButtonWrapper, {
  ButtonWrapperProps,
} from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

function AddAnotherEmailBtn({ onClick, ...props }: ButtonWrapperProps) {
  const { t } = useTranslation()

  return (
    <ButtonWrapper
      variant="link"
      onClick={onClick}
      {...props}
      bs3Props={{ bsStyle: null, className: 'btn-inline-link' }}
    >
      {t('add_another_email')}
    </ButtonWrapper>
  )
}

export default AddAnotherEmailBtn
