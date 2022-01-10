import { useMemo } from 'react'
import { Row } from 'react-bootstrap'
import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'
import { useProjectContext } from '../../../shared/context/project-context'

export default function SendInvites() {
  const { members, invites, features } = useProjectContext()

  // whether the project has not reached the collaborator limit
  const canAddCollaborators = useMemo(() => {
    if (!features) {
      return false
    }

    if (features.collaborators === -1) {
      // infinite collaborators
      return true
    }

    return members.length + invites.length < features.collaborators
  }, [members, invites, features])

  return (
    <Row className="invite-controls">
      {canAddCollaborators ? <AddCollaborators /> : <AddCollaboratorsUpgrade />}
    </Row>
  )
}
