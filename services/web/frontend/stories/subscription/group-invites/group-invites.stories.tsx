import GroupInvites from '@/features/subscription/components/group-invites/group-invites'
import type { TeamInvite } from '../../../../types/team-invite'
import { useMeta } from '../../hooks/use-meta'
import { ScopeDecorator } from '../../decorators/scope'

export const GroupInvitesDefault = () => {
  const teamInvites: TeamInvite[] = [
    {
      email: 'email1@exammple.com',
      token: 'token123',
      inviterName: 'inviter1@example.com',
      sentAt: new Date(),
      _id: '123abc',
    },
    {
      email: 'email2@exammple.com',
      token: 'token456',
      inviterName: 'inviter2@example.com',
      sentAt: new Date(),
      _id: '456bcd',
    },
  ]

  useMeta({ 'ol-teamInvites': teamInvites })

  return (
    <div className="content content-alt team-invite">
      <GroupInvites />
    </div>
  )
}

export default {
  title: 'Subscription / Group Invites',
  component: GroupInvites,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    onDisableSSO: { action: 'callback' },
  },
  decorators: [ScopeDecorator],
}
