import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Icon from '../../../../../shared/components/icon'

type SubmitButtonProps = {
  isProcessing: boolean
  isFormValid: boolean
  children: React.ReactNode
}

function SubmitButton(props: SubmitButtonProps) {
  const { t } = useTranslation()

  return (
    <Button
      type="submit"
      bsStyle="primary"
      className="btn-block"
      disabled={props.isProcessing || !props.isFormValid}
    >
      {props.isProcessing && (
        <>
          <Icon type="spinner" spin />
          <span className="sr-only">{t('processing')}</span>
        </>
      )}{' '}
      {props.children}
    </Button>
  )
}

export default SubmitButton
