import React, { useCallback } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import CloneProjectModal from './clone-project-modal'

type ProjectCopyResponse = {
  project_id: string
}

const EditorCloneProjectModalWrapper = React.memo(
  function EditorCloneProjectModalWrapper({
    show,
    handleHide,
    openProject,
  }: {
    show: boolean
    handleHide: () => void
    openProject: (projectId: string) => void
  }) {
    const { project, tags: projectTags } = useProjectContext()
    const handleAfterCloned = useCallback(
      ({ project_id: projectId }: ProjectCopyResponse) => {
        openProject(projectId)
      },
      [openProject]
    )

    if (!project) {
      // wait for useProjectContext
      return null
    } else {
      return (
        <CloneProjectModal
          handleHide={handleHide}
          show={show}
          handleAfterCloned={handleAfterCloned}
          projectId={project._id}
          projectName={project.name}
          projectTags={projectTags}
        />
      )
    }
  }
)

export default withErrorBoundary(EditorCloneProjectModalWrapper)
