import { Trans } from 'react-i18next'
import GroupInvitesItemFooter from './group-invites-item-footer'
import type { TeamInvite } from '../../../../../../types/team-invite'
import OLPageContentCard from '@/features/ui/components/ol/ol-page-content-card'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'

type GroupInvitesItemProps = {
  teamInvite: TeamInvite
}

export default function GroupInvitesItem({
  teamInvite,
}: GroupInvitesItemProps) {
  return (
    <OLRow className="row-spaced">
      <OLCol lg={{ span: 8, offset: 2 }} className="text-center">
        <OLPageContentCard>
          <div className="page-header">
            <h2>
              <Trans
                i18nKey="invited_to_group"
                values={{ inviterName: teamInvite.inviterName }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
                components={
                  /* eslint-disable-next-line react/jsx-key */
                  [<span className="team-invite-name" />]
                }
              />
            </h2>
          </div>
          <GroupInvitesItemFooter teamInvite={teamInvite} />
        </OLPageContentCard>
      </OLCol>
    </OLRow>
  )
}
