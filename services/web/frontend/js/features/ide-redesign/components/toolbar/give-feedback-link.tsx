import { useTranslation } from 'react-i18next'
import { useSurveyUrl } from '../../hooks/use-survey-url'

export const GiveFeedbackLink = () => {
  const { t } = useTranslation()
  const surveyURL = useSurveyUrl()

  return (
    <div className="ide-redesign-toolbar-button-container">
      <a
        href={surveyURL}
        rel="noopener noreferrer"
        target="_blank"
        className="ide-redesign-toolbar-labs-feedback-link"
      >
        {t('give_feedback')}
      </a>
    </div>
  )
}
