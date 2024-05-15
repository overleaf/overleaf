import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import { useUserEmailsContext } from '../context/user-email-context'
import { sendMB } from '../../../infrastructure/event-tracking'
import OLNotification from '@/features/ui/components/ol/ol-notification'

function sendMetrics(segmentation: 'view' | 'click' | 'close') {
  sendMB('institutional-leavers-survey-notification', { type: segmentation })
}

export function LeaversSurveyAlert() {
  const { t } = useTranslation()

  const {
    showInstitutionalLeaversSurveyUntil,
    setShowInstitutionalLeaversSurveyUntil,
  } = useUserEmailsContext()

  const [hide, setHide] = usePersistedState(
    'hideInstitutionalLeaversSurvey',
    false,
    true
  )

  function handleDismiss() {
    setShowInstitutionalLeaversSurveyUntil(0)
    setHide(true)
    sendMetrics('close')
  }

  function handleLinkClick() {
    sendMetrics('click')
  }

  const shouldDisplay =
    !hide && Date.now() <= showInstitutionalLeaversSurveyUntil

  useEffect(() => {
    if (shouldDisplay) {
      sendMetrics('view')
    }
  }, [shouldDisplay])

  if (!shouldDisplay) {
    return null
  }

  return (
    <OLNotification
      type="info"
      content={
        <>
          <strong>{t('limited_offer')}</strong>
          {`: ${t('institutional_leavers_survey_notification')} `}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfYdeeoY5p1d31r5iUx1jw0O-Gd66vcsBi_Ntu3lJRMjV2EJA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
          >
            {t('take_short_survey')}
          </a>
        </>
      }
      isDismissible
      onDismiss={handleDismiss}
      className="mb-0"
    />
  )
}
