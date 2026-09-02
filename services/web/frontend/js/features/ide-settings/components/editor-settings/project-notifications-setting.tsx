import { useTranslation } from 'react-i18next'
import RadioButtonSetting, { RadioOption } from '../radio-button-setting'
import {
  SettableNotificationLevel,
  useProjectNotificationPreferences,
} from '../../hooks/use-project-notification-preferences'
import LoadingSpinner from '@/shared/components/loading-spinner'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export default function ProjectNotificationsSetting() {
  const { t } = useTranslation()
  const commentMentionsEnabled = useFeatureFlag('comment-mentions')
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
      label: commentMentionsEnabled
        ? t('mentions_and_replies_only')
        : t('replies_to_your_activity_only'),
      description: commentMentionsEnabled
        ? t('mentions_and_replies_only_description')
        : t('replies_to_your_activity_only_description'),
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
        </>
      )}
    </>
  )
}
