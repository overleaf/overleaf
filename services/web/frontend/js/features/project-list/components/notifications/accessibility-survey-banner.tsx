import { memo, useEffect, useState } from 'react'
import Notification from './notification'
import customLocalStorage from '@/infrastructure/local-storage'
import { useTranslation } from 'react-i18next'

function AccessibilitySurveyBanner() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isDismissed = customLocalStorage.getItem(
      'has_dismissed_accessibility_survey_banner'
    )
    if (!isDismissed) setShow(true)
  }, [])

  const handleClose = () => {
    customLocalStorage.setItem(
      'has_dismissed_accessibility_survey_banner',
      'true'
    )
    setShow(false)
  }

  if (!show) return null

  return (
    <Notification
      className="sr-only"
      bsStyle="info"
      onDismiss={handleClose}
      body={<p>{t('help_improve_screen_reader_fill_out_this_survey')}</p>}
      action={
        <a
          className="btn btn-secondary btn-sm pull-right btn-info"
          href="https://docs.google.com/forms/d/e/1FAIpQLSdxKP_biRXvrkmJzlBjMwI_qPSuv4NbBvYUzSOc3OOTIOTmnQ/viewform"
          target="_blank"
          rel="noreferrer"
        >
          {t('take_survey')}
        </a>
      }
    />
  )
}

export default memo(AccessibilitySurveyBanner)
