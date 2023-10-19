import { Col, Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '../../../shared/context/project-context'

export default function SendInvitesNotice() {
  const { publicAccessLevel } = useProjectContext()

  return (
    <Row className="public-access-level public-access-level--notice">
      <Col xs={12} className="text-center">
        <AccessLevel level={publicAccessLevel} />
      </Col>
    </Row>
  )
}

function AccessLevel({ level }) {
  const { t } = useTranslation()
  switch (level) {
    case 'private':
      return t('to_add_more_collaborators')

    case 'tokenBased':
      return t('to_change_access_permissions')

    default:
      return null
  }
}
AccessLevel.propTypes = {
  level: PropTypes.string,
}
