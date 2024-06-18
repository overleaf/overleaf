import { useEffect } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import { useLocation } from '@/shared/hooks/use-location'
import GroupInvitesItem from './group-invites-item'

function GroupInvites() {
  const { t } = useTranslation()
  const teamInvites = getMeta('ol-teamInvites')
  const location = useLocation()

  useEffect(() => {
    if (teamInvites.length === 0) {
      location.assign('/project')
    }
  }, [teamInvites, location])

  return (
    <div className="container">
      <Row>
        <Col md={8} mdOffset={2}>
          <h1>{t('group_invitations')}</h1>
        </Col>
      </Row>
      {teamInvites.map(teamInvite => (
        <GroupInvitesItem teamInvite={teamInvite} key={teamInvite._id} />
      ))}
    </div>
  )
}

export default GroupInvites
