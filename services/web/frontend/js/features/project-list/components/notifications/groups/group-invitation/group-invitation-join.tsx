import { useTranslation, Trans } from 'react-i18next'
import Notification from '../../notification'
import type { NotificationGroupInvitation } from '../../../../../../../../types/project/dashboard/notification'
import OLButton from '@/shared/components/ol/ol-button'

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
    <Notification
      type="info"
      onDismiss={dismissGroupInviteNotification}
      content={
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
        <OLButton
          variant="secondary"
          onClick={acceptGroupInvite}
          disabled={isAcceptingInvitation}
        >
          {t('join_now')}
        </OLButton>
      }
    />
  )
}
