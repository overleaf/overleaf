import { Row } from 'react-bootstrap'
import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'
import CollaboratorsLimitUpgrade from './collaborators-limit-upgrade'
import PropTypes from 'prop-types'

export default function SendInvites({
  canAddCollaborators,
  hasExceededCollaboratorLimit,
}) {
  return (
    <Row className="invite-controls">
      {hasExceededCollaboratorLimit && <AddCollaboratorsUpgrade />}
      {!canAddCollaborators && !hasExceededCollaboratorLimit && (
        <CollaboratorsLimitUpgrade />
      )}
      <AddCollaborators readOnly={!canAddCollaborators} />
    </Row>
  )
}

SendInvites.propTypes = {
  canAddCollaborators: PropTypes.bool,
  hasExceededCollaboratorLimit: PropTypes.bool,
}
