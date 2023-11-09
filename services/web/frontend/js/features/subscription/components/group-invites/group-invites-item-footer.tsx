import { useTranslation } from 'react-i18next'
import type { TeamInvite } from '../../../../../../types/team-invite'

type GroupInvitesItemFooterProps = {
  teamInvite: TeamInvite
}

export default function GroupInvitesItemFooter({
  teamInvite,
}: GroupInvitesItemFooterProps) {
  const { t } = useTranslation()

  return (
    <div>
      <p data-cy="group-invites-item-footer-text">
        {t('join_team_explanation')}
      </p>
      <div data-cy="group-invites-item-footer-link">
        <a
          className="btn btn-primary"
          href={`/subscription/invites/${teamInvite.token}`}
        >
          {t('view_invitation')}
        </a>
      </div>
    </div>
  )
}
