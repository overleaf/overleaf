import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import type { Dispatch, SetStateAction } from 'react'
import Notification from '../../notification'
import { GroupInvitationStatus } from './hooks/use-group-invitation-notification'
import type { NotificationGroupInvitation } from '../../../../../../../../types/project/dashboard/notification'

type GroupInvitationCancelIndividualSubscriptionNotificationProps = {
  setGroupInvitationStatus: Dispatch<SetStateAction<GroupInvitationStatus>>
  cancelPersonalSubscription: () => void
  dismissGroupInviteNotification: () => void
  notification: NotificationGroupInvitation
}

export default function GroupInvitationCancelIndividualSubscriptionNotification({
  setGroupInvitationStatus,
  cancelPersonalSubscription,
  dismissGroupInviteNotification,
  notification,
}: GroupInvitationCancelIndividualSubscriptionNotificationProps) {
  const { t } = useTranslation()
  const {
    messageOpts: { inviterName },
  } = notification

  return (
    <Notification bsStyle="info" onDismiss={dismissGroupInviteNotification}>
      <Notification.Body>
        {t('invited_to_group_have_individual_subcription', { inviterName })}
      </Notification.Body>
      <Notification.Action className="group-invitation-cancel-subscription-notification-buttons">
        <Button
          bsStyle="info"
          bsSize="sm"
          className="me-1"
          onClick={() =>
            setGroupInvitationStatus(GroupInvitationStatus.AskToJoin)
          }
        >
          {t('not_now')}
        </Button>
        <Button bsStyle="info" bsSize="sm" onClick={cancelPersonalSubscription}>
          {t('cancel_my_subscription')}
        </Button>
      </Notification.Action>
    </Notification>
  )
}
