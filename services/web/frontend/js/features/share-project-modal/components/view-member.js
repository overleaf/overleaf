import PropTypes from 'prop-types'
import { Col, Row } from 'react-bootstrap'
import MemberPrivileges from './member-privileges'

export default function ViewMember({ member }) {
  return (
    <Row className="project-member">
      <Col xs={7}>{member.email}</Col>
      <Col xs={3}>
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
