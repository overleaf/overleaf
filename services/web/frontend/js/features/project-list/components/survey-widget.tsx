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
    <>
      <button
        className="project-list-sidebar-survey-dismiss"
        type="button"
        title="Dismiss Overleaf survey"
        onClick={dismissSurvey}
      >
        <span aria-hidden>&times;</span>
      </button>
      <div className="project-list-sidebar-survey">
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
    </>
  )
}
