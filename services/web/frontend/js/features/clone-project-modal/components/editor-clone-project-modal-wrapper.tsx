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
    const { project, tags: projectTags } = useProjectContext()

    if (!project) {
      // wait for useProjectContext
      return null
    } else {
      return (
        <CloneProjectModal
          handleHide={handleHide}
          show={show}
          handleAfterCloned={openProject}
          projectId={project._id}
          projectName={project.name}
          projectTags={projectTags}
        />
      )
    }
  }
)

export default withErrorBoundary(EditorCloneProjectModalWrapper)
