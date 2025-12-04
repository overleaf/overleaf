import { useTranslation } from 'react-i18next'
import RadioButtonSetting, { RadioOption } from '../radio-button-setting'
import { useState } from 'react'

type NotificationLevel = 'all' | 'replies' | 'off'

export default function ProjectNotificationsSetting() {
  const { t } = useTranslation()
  // TODO: Connect to project settings context when backend support is added
  const [notificationLevel, setNotificationLevel] =
    useState<NotificationLevel>('all')

  const options: Array<RadioOption<NotificationLevel>> = [
    {
      value: 'all',
      label: t('all_project_activity'),
      description: t('all_project_activity_description'),
    },
    {
      value: 'replies',
      label: t('replies_to_your_activity_only'),
      description: t('replies_to_your_activity_only_description'),
    },
    {
      value: 'off',
      label: t('off'),
      description: t('no_project_notifications_description'),
    },
  ]

  return (
    <>
      <RadioButtonSetting
        id="projectNotifications"
        options={options}
        value={notificationLevel}
        onChange={setNotificationLevel}
      />
      <div className="project-notifications-beta-note">
        <span className="beta-note-text">
          {t('email_notifications_are_currently_in_beta')}{' '}
          {t('these_settings_might_change_in_the_future')}{' '}
        </span>
        {/* TODO: update forms link */}
        <a target="_blank" rel="noopener noreferrer" href="https://forms.gle/">
          {t('give_feedback')}
        </a>
      </div>
    </>
  )
}
