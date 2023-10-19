import { Button } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import Notification from '../../notification'
import type { NotificationGroupInvitation } from '../../../../../../../../types/project/dashboard/notification'

type GroupInvitationNotificationProps = {
  acceptGroupInvite: () => void
  notification: NotificationGroupInvitation
  isAcceptingInvitation: boolean
  dismissGroupInviteNotification: () => void
}

export default function GroupInvitationNotificationJoin({
  acceptGroupInvite,
  notification,
  isAcceptingInvitation,
  dismissGroupInviteNotification,
}: GroupInvitationNotificationProps) {
  const { t } = useTranslation()
  const {
    messageOpts: { inviterName },
  } = notification

  return (
    <Notification bsStyle="info" onDismiss={dismissGroupInviteNotification}>
      <Notification.Body>
        <Trans
          i18nKey="invited_to_group"
          values={{
            inviterName,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      </Notification.Body>
      <Notification.Action>
        <Button
          bsStyle="info"
          bsSize="sm"
          className="pull-right"
          onClick={acceptGroupInvite}
          disabled={isAcceptingInvitation}
        >
          {t('join_now')}
        </Button>
      </Notification.Action>
    </Notification>
  )
}
