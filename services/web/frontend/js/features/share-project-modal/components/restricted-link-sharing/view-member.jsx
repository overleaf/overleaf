import PropTypes from 'prop-types'
import { Col, Row } from 'react-bootstrap'
import MemberPrivileges from './member-privileges'
import Icon from '@/shared/components/icon'

export default function ViewMember({ member }) {
  return (
    <Row className="project-member">
      <Col xs={8}>
        <div className="project-member-email-icon">
          <Icon type="user" fw />
          <div className="email-warning">{member.email}</div>
        </div>
      </Col>
      <Col xs={4} className="text-right">
        <MemberPrivileges privileges={member.privileges} />
      </Col>
    </Row>
  )
}

ViewMember.propTypes = {
  member: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    privileges: PropTypes.string.isRequired,
  }).isRequired,
}
