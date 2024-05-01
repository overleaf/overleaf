import { Button } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import Notification from '../../notification'
import type { NotificationGroupInvitation } from '../../../../../../../../types/project/dashboard/notification'
import getMeta from '@/utils/meta'

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
      body={
        <Trans
          i18nKey="invited_to_group"
          values={{ inviterName }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={
            /* eslint-disable-next-line react/jsx-key */
            [<span className="team-invite-name" />]
          }
        />
      }
      action={
        <Button
          bsStyle={newNotificationStyle ? null : 'info'}
          bsSize="sm"
          className={newNotificationStyle ? 'btn-secondary' : 'pull-right'}
          onClick={acceptGroupInvite}
          disabled={isAcceptingInvitation}
        >
          {t('join_now')}
        </Button>
      }
    />
  )
}
