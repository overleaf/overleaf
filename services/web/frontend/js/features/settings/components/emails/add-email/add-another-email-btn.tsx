import { useTranslation } from 'react-i18next'
import { Button, ButtonProps } from 'react-bootstrap'

function AddAnotherEmailBtn({ onClick, ...props }: ButtonProps) {
  const { t } = useTranslation()

  return (
    <Button
      className="btn-inline-link"
      onClick={onClick}
      {...props}
      bsStyle={null}
    >
      {t('add_another_email')}
    </Button>
  )
}

export default AddAnotherEmailBtn
