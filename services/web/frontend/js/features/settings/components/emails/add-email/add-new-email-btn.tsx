import { useTranslation } from 'react-i18next'
import { Button, ButtonProps } from 'react-bootstrap'

const isValidEmail = (email: string) => {
  return Boolean(email)
}

type AddNewEmailColProps = {
  email: string
} & ButtonProps

function AddNewEmailBtn({ email, disabled, ...props }: AddNewEmailColProps) {
  const { t } = useTranslation()

  return (
    <Button
      bsSize="small"
      bsStyle="success"
      disabled={disabled || !isValidEmail(email)}
      {...props}
    >
      {t('add_new_email')}
    </Button>
  )
}

export default AddNewEmailBtn
