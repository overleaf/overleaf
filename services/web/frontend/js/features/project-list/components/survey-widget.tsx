import usePersistedState from '../../../shared/hooks/use-persisted-state'
import getMeta from '../../../utils/meta'
import { Survey } from '../../../../../types/project/dashboard/survey'
import { useCallback } from 'react'

export default function SurveyWidget() {
  const survey: Survey = getMeta('ol-survey')
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
    <div className="user-notifications">
      <div className="notification-entry">
        <div role="alert" className="alert alert-info-alt">
          <div className="notification-body">
            {survey.preText}&nbsp;
            <a
              className="project-list-sidebar-survey-link"
              href={survey.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {survey.linkText}
            </a>
          </div>
          <div className="notification-close">
            <button
              type="button"
              className="close pull-right"
              title="Dismiss Overleaf survey"
              onClick={dismissSurvey}
            >
              <span aria-hidden="true">&times;</span>
              <span className="sr-only">Dismiss Overleaf survey</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
