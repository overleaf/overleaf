import { useTranslation } from 'react-i18next'
import RadioButtonSetting, { RadioOption } from '../radio-button-setting'
import {
  SettableNotificationLevel,
  useProjectNotificationPreferences,
} from '../../hooks/use-project-notification-preferences'
import BetaBadgeIcon from '@/shared/components/beta-badge-icon'
import LoadingSpinner from '@/shared/components/loading-spinner'

export default function ProjectNotificationsSetting() {
  const { t } = useTranslation()
  const { notificationLevel, setNotificationLevel, isLoading } =
    useProjectNotificationPreferences()

  if (isLoading) {
    return <LoadingSpinner loadingText={t('loading')} />
  }

  const options: Array<RadioOption<SettableNotificationLevel>> = [
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
      {notificationLevel === 'global-off' ? (
        <div className="ide-setting-description">
          {t('project_notifications_muted_description')}{' '}
          <a
            href="/user/notification-preferences"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('change_settings')}
          </a>
        </div>
      ) : (
        <>
          <RadioButtonSetting
            id="projectNotifications"
            options={options}
            value={notificationLevel}
            onChange={setNotificationLevel}
          />

          <div className="global-notifications-link">
            <a
              href="/user/notification-preferences"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('manage_overleaf_email_preferences')}
            </a>
          </div>
          <div className="project-notifications-beta-note">
            <BetaBadgeIcon />
            <div>
              <span className="ide-setting-description">
                {t('email_notifications_are_currently_in_beta')}{' '}
                {t('these_settings_might_change_in_the_future')}{' '}
              </span>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://forms.gle/unCNQedYXChTn2Qo6"
              >
                {t('give_feedback')}
              </a>
            </div>
          </div>
        </>
      )}
    </>
  )
}
