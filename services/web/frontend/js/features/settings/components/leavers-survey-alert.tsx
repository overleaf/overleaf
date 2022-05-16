import { Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import usePersistedState from '../../../shared/hooks/use-persisted-state'

export function LeaversSurveyAlert() {
  const { t } = useTranslation()

  const [expirationDate, setExpirationDate] = usePersistedState(
    'showInstitutionalLeaversSurveyUntil',
    0
  )
  function handleDismiss() {
    setExpirationDate(0)
  }

  if (Date.now() > expirationDate) {
    return null
  }

  return (
    <Alert className="mb-0" bsStyle="info" onDismiss={handleDismiss}>
      <p>
        <strong>{t('limited_offer')}</strong>
        {`: ${t('institutional_leavers_survey_notification')} `}
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSfYdeeoY5p1d31r5iUx1jw0O-Gd66vcsBi_Ntu3lJRMjV2EJA/viewform"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('take_short_survey')}
        </a>
      </p>
    </Alert>
  )
}
