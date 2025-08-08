import usePersistedState from '../../../shared/hooks/use-persisted-state'
import getMeta from '../../../utils/meta'
import { useCallback } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { X } from '@phosphor-icons/react'

export function SurveyWidgetDsNav() {
  const { t } = useTranslation()
  const survey = getMeta('ol-survey')
  const [dismissedSurvey, setDismissedSurvey] = usePersistedState(
    `dismissed-${survey?.name}`,
    false
  )

  const dismissSurvey = useCallback(() => {
    setDismissedSurvey(true)
  }, [setDismissedSurvey])

  if (!survey?.name || dismissedSurvey) {
    return null
  }

  return (
    <aside className="user-notifications" aria-label={t('feedback')}>
      <div className="notification-entry">
        <div role="alert" className="survey-notification">
          <div className="notification-body">
            <p className="fw-bold fs-6 pe-4">{survey.title}</p>
            <p>{survey.text}</p>
            <OLButton
              variant="secondary"
              size="sm"
              href={survey.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {survey.cta || t('take_survey')}
            </OLButton>
          </div>
          <OLButton
            variant="ghost"
            className="user-notification-close"
            onClick={() => dismissSurvey()}
          >
            <X size={16} onClick={() => dismissSurvey()} />
            <span className="visually-hidden">{t('close')}</span>
          </OLButton>
        </div>
      </div>
    </aside>
  )
}
