import { Row } from 'react-bootstrap'
import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'
import PropTypes from 'prop-types'

export default function SendInvites({ canAddCollaborators }) {
  return (
    <Row className="invite-controls">
      {canAddCollaborators ? <AddCollaborators /> : <AddCollaboratorsUpgrade />}
    </Row>
  )
}

SendInvites.propTypes = {
  canAddCollaborators: PropTypes.bool,
}
