import Notification from '../../notification'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'
import getMeta from '@/utils/meta'

type GroupInvitationSuccessfulNotificationProps = {
  hideNotification: () => void
}

export default function GroupInvitationSuccessfulNotification({
  hideNotification,
}: GroupInvitationSuccessfulNotificationProps) {
  const { t } = useTranslation()
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean

  return (
    <Notification
      bsStyle="success"
      onDismiss={hideNotification}
      body={
        <>
          {!newNotificationStyle && (
            <Icon type="check-circle" fw aria-hidden="true" className="me-1" />
          )}
          {t('congratulations_youve_successfully_join_group')}
        </>
      }
    />
  )
}
