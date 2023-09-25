import Notification from '../../notification'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'

type GroupInvitationSuccessfulNotificationProps = {
  hideNotification: () => void
}

export default function GroupInvitationSuccessfulNotification({
  hideNotification,
}: GroupInvitationSuccessfulNotificationProps) {
  const { t } = useTranslation()

  return (
    <Notification bsStyle="success" onDismiss={hideNotification}>
      <Notification.Body>
        <Icon type="check-circle" fw aria-hidden="true" className="me-1" />
        {t('congratulations_youve_successfully_join_group')}
      </Notification.Body>
    </Notification>
  )
}
