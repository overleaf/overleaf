import Notification from '../../notification'
import { useTranslation } from 'react-i18next'

type GroupInvitationSuccessfulNotificationProps = {
  hideNotification: () => void
}

export default function GroupInvitationSuccessfulNotification({
  hideNotification,
}: GroupInvitationSuccessfulNotificationProps) {
  const { t } = useTranslation()

  return (
    <Notification
      type="success"
      onDismiss={hideNotification}
      content={t('congratulations_youve_successfully_join_group')}
    />
  )
}
