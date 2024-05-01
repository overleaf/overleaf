import { Col, Row } from 'react-bootstrap'
import { Trans } from 'react-i18next'
import GroupInvitesItemFooter from './group-invites-item-footer'
import type { TeamInvite } from '../../../../../../types/team-invite'

type GroupInvitesItemProps = {
  teamInvite: TeamInvite
}

export default function GroupInvitesItem({
  teamInvite,
}: GroupInvitesItemProps) {
  return (
    <Row className="row-spaced">
      <Col md={8} mdOffset={2} className="text-center">
        <div className="card">
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
        </div>
      </Col>
    </Row>
  )
}
