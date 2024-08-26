import { Row } from 'react-bootstrap'
import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'
import CollaboratorsLimitUpgrade from './collaborators-limit-upgrade'
import AccessLevelsChanged from './access-levels-changed'
import PropTypes from 'prop-types'

export default function SendInvites({
  canAddCollaborators,
  hasExceededCollaboratorLimit,
  haveAnyEditorsBeenDowngraded,
  somePendingEditorsResolved,
}) {
  return (
    <Row className="invite-controls">
      {hasExceededCollaboratorLimit && !haveAnyEditorsBeenDowngraded && (
        <AddCollaboratorsUpgrade />
      )}

      {haveAnyEditorsBeenDowngraded && (
        <AccessLevelsChanged
          somePendingEditorsResolved={somePendingEditorsResolved}
        />
      )}

      {!canAddCollaborators &&
        !hasExceededCollaboratorLimit &&
        !haveAnyEditorsBeenDowngraded && <CollaboratorsLimitUpgrade />}
      <AddCollaborators readOnly={!canAddCollaborators} />
    </Row>
  )
}

SendInvites.propTypes = {
  canAddCollaborators: PropTypes.bool,
  hasExceededCollaboratorLimit: PropTypes.bool,
  haveAnyEditorsBeenDowngraded: PropTypes.bool,
  somePendingEditorsResolved: PropTypes.bool,
}
