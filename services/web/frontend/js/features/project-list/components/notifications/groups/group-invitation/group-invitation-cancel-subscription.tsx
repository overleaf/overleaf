import { useTranslation } from 'react-i18next'
import type { Dispatch, SetStateAction } from 'react'
import Notification from '../../notification'
import { GroupInvitationStatus } from './hooks/use-group-invitation-notification'
import type { NotificationGroupInvitation } from '../../../../../../../../types/project/dashboard/notification'
import OLButton from '@/shared/components/ol/ol-button'

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
    <Notification
      type="info"
      onDismiss={dismissGroupInviteNotification}
      content={t('invited_to_group_have_individual_subcription', {
        inviterName,
      })}
      action={
        <>
          <OLButton
            variant="secondary"
            onClick={() =>
              setGroupInvitationStatus(GroupInvitationStatus.AskToJoin)
            }
            className="me-1"
          >
            {t('not_now')}
          </OLButton>
          <OLButton variant="secondary" onClick={cancelPersonalSubscription}>
            {t('cancel_my_subscription')}
          </OLButton>
        </>
      }
    />
  )
}
