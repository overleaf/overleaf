import React from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import CloneProjectModal from './clone-project-modal'

const EditorCloneProjectModalWrapper = React.memo(
  function EditorCloneProjectModalWrapper({
    show,
    handleHide,
    openProject,
  }: {
    show: boolean
    handleHide: () => void
    openProject: ({ project_id }: { project_id: string }) => void
  }) {
    const {
      _id: projectId,
      name: projectName,
      tags: projectTags,
    } = useProjectContext()

    if (!projectName) {
      // wait for useProjectContext
      return null
    } else {
      return (
        <CloneProjectModal
          handleHide={handleHide}
          show={show}
          handleAfterCloned={openProject}
          projectId={projectId}
          projectName={projectName}
          projectTags={projectTags}
        />
      )
    }
  }
)

export default withErrorBoundary(EditorCloneProjectModalWrapper)
