import React from 'react'
import PropTypes from 'prop-types'
import { useProjectContext } from '../../../shared/context/project-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import CloneProjectModal from './clone-project-modal'

const EditorCloneProjectModalWrapper = React.memo(
  function EditorCloneProjectModalWrapper({ show, handleHide, openProject }) {
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

EditorCloneProjectModalWrapper.propTypes = {
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  openProject: PropTypes.func.isRequired,
}

export default withErrorBoundary(EditorCloneProjectModalWrapper)
