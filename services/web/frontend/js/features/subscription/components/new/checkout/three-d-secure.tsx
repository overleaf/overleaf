import { useTranslation } from 'react-i18next'
import { Alert } from 'react-bootstrap'

function ThreeDSecure() {
  const { t } = useTranslation()

  return (
    <div className="three-d-secure-container--react">
      <Alert bsStyle="info" className="small" aria-live="assertive">
        <strong>{t('card_must_be_authenticated_by_3dsecure')}</strong>
      </Alert>
      <div className="three-d-secure-recurly-container">
        {/* {threeDSecureFlowError && <>{threeDSecureFlowError.message}</>} */}
        {/* <ThreeDSecureAction {...props} /> */}
      </div>
    </div>
  )
}

export default ThreeDSecure
