import { Col, Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { Trans } from 'react-i18next'
import { useProjectContext } from '../../../shared/context/project-context'

export default function SendInvitesNotice() {
  const project = useProjectContext()

  return (
    <Row className="public-access-level public-access-level--notice">
      <Col xs={12} className="text-center">
        <AccessLevel level={project.publicAccesLevel} />
      </Col>
    </Row>
  )
}

function AccessLevel({ level }) {
  switch (level) {
    case 'private':
      return <Trans i18nKey="to_add_more_collaborators" />

    case 'tokenBased':
      return <Trans i18nKey="to_change_access_permissions" />

    default:
      return null
  }
}
AccessLevel.propTypes = {
  level: PropTypes.string,
}
