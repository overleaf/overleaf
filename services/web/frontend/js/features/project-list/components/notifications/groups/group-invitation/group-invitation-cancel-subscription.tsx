import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import type { Dispatch, SetStateAction } from 'react'
import Notification from '../../notification'
import { GroupInvitationStatus } from './hooks/use-group-invitation-notification'
import type { NotificationGroupInvitation } from '../../../../../../../../types/project/dashboard/notification'
import getMeta from '@/utils/meta'

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
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean
  const {
    messageOpts: { inviterName },
  } = notification

  return (
    <Notification
      bsStyle="info"
      onDismiss={dismissGroupInviteNotification}
      body={t('invited_to_group_have_individual_subcription', { inviterName })}
      action={
        <div className="group-invitation-cancel-subscription-notification-buttons">
          <Button
            bsStyle={newNotificationStyle ? null : 'info'}
            bsSize="sm"
            className={newNotificationStyle ? 'me-1 btn-secondary' : 'me-1'}
            onClick={() =>
              setGroupInvitationStatus(GroupInvitationStatus.AskToJoin)
            }
          >
            {t('not_now')}
          </Button>
          <Button
            bsStyle={newNotificationStyle ? null : 'info'}
            className={newNotificationStyle ? 'btn-secondary' : ''}
            bsSize="sm"
            onClick={cancelPersonalSubscription}
          >
            {t('cancel_my_subscription')}
          </Button>
        </div>
      }
    />
  )
}
