import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import GroupInvitesItemFooter from './group-invites-item-footer'
import type { TeamInvite } from '../../../../../../types/team-invite'

type GroupInvitesItemProps = {
  teamInvite: TeamInvite
}

export default function GroupInvitesItem({
  teamInvite,
}: GroupInvitesItemProps) {
  const { t } = useTranslation()

  return (
    <Row className="row-spaced">
      <Col md={8} mdOffset={2} className="text-center">
        <div className="card">
          <div className="page-header">
            <h2>
              {t('invited_to_group', {
                inviterName: teamInvite.inviterName,
              })}
            </h2>
          </div>
          <GroupInvitesItemFooter teamInvite={teamInvite} />
        </div>
      </Col>
    </Row>
  )
}
