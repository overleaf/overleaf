import { useCallback, useEffect, useState } from 'react'
import Notification from './notification'
import { sendMB } from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { Trans, useTranslation } from 'react-i18next'

export default function NewUsersMicroSurvey() {
  const { t } = useTranslation()

  const showNewUsersMicroSurvey = getMeta(
    'ol-showNewUsersMicroSurvey'
  ) as boolean

  const hasDismissedNewUsersMicroSurvey = customLocalStorage.getItem(
    'has_dismissed_new_users_micro_survey'
  )

  // need extra state to close the survey when user clicking the main button
  const [show, setShow] = useState(!hasDismissedNewUsersMicroSurvey)

  const handleClose = useCallback(() => {
    customLocalStorage.setItem('has_dismissed_new_users_micro_survey', true)
  }, [])

  const handleClickTakeSurvey = useCallback(() => {
    customLocalStorage.setItem('has_dismissed_new_users_micro_survey', true)

    setShow(false)

    sendMB('new-users-micro-survey-click', {
      'project-dashboard-react': 'enabled',
    })
  }, [])

  useEffect(() => {
    sendMB('new-users-micro-survey-prompt', {
      'project-dashboard-react': 'enabled',
    })
  }, [])

  if (hasDismissedNewUsersMicroSurvey || !showNewUsersMicroSurvey || !show) {
    return null
  }

  return (
    <Notification bsStyle="info" onDismiss={handleClose}>
      <Notification.Body>
        <span>
          <Trans
            i18nKey="help_us_improve_overleaf_by_answering_a_two_question_survey"
            components={
              /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
              [<strong />]
            }
          />
        </span>
      </Notification.Body>
      <Notification.Action>
        <a
          className="pull-right btn btn-info btn-sm"
          href="https://docs.google.com/forms/d/e/1FAIpQLSdN23eSbaGkl96-LkNiIW1QCVdhAQEnSGrEhbuuZgNQ5-Qvog/viewform?usp=sf_link"
          rel="noreferrer"
          target="_blank"
          onClick={handleClickTakeSurvey}
        >
          {t('take_survey')}
        </a>
      </Notification.Action>
    </Notification>
  )
}
