import React, { useMemo } from 'react'
import { Row } from 'react-bootstrap'
import { useProjectContext } from './share-project-modal'
import AddCollaborators from './add-collaborators'
import AddCollaboratorsUpgrade from './add-collaborators-upgrade'

export default function SendInvites() {
  const project = useProjectContext()

  // whether the project has not reached the collaborator limit
  const canAddCollaborators = useMemo(() => {
    if (!project) {
      return false
    }

    if (project.features.collaborators === -1) {
      // infinite collaborators
      return true
    }

    return (
      project.members.length + project.invites.length <
      project.features.collaborators
    )
  }, [project])

  return (
    <Row className="invite-controls">
      {canAddCollaborators ? <AddCollaborators /> : <AddCollaboratorsUpgrade />}
    </Row>
  )
}
