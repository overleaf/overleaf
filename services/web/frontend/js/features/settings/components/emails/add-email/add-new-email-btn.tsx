import { useTranslation } from 'react-i18next'
import ButtonWrapper, {
  ButtonWrapperProps,
} from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

const isValidEmail = (email: string) => {
  return Boolean(email)
}

type AddNewEmailColProps = {
  email: string
} & ButtonWrapperProps

function AddNewEmailBtn({
  email,
  disabled,
  isLoading,
  ...props
}: AddNewEmailColProps) {
  const { t } = useTranslation()

  return (
    <ButtonWrapper
      size="small"
      variant="primary"
      disabled={(disabled && !isLoading) || !isValidEmail(email)}
      isLoading={isLoading}
      {...props}
    >
      {t('add_new_email')}
    </ButtonWrapper>
  )
}

export default AddNewEmailBtn
