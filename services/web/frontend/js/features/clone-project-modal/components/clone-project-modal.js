import React, { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { cloneProject } from '../utils/api'
import CloneProjectModalContent from './clone-project-modal-content'

function CloneProjectModal({
  show,
  handleHide,
  projectId,
  projectName = '',
  openProject,
}) {
  const [inFlight, setInFlight] = useState(false)
  const [error, setError] = useState()
  const [clonedProjectName, setClonedProjectName] = useState('')

  // set the cloned project name when the modal opens
  useEffect(() => {
    if (show) {
      setClonedProjectName(`${projectName} (Copy)`)
    }
  }, [show, projectName])

  // reset error when the modal is opened
  useEffect(() => {
    if (show) {
      setError(undefined)
    }
  }, [show])

  // close the modal if not in flight
  const cancel = useCallback(() => {
    if (!inFlight) {
      handleHide()
    }
  }, [handleHide, inFlight])

  // valid if the cloned project has a name
  const valid = useMemo(() => !!clonedProjectName, [clonedProjectName])

  // form submission: clone the project if the name is valid
  const handleSubmit = event => {
    event.preventDefault()

    if (!valid) {
      return
    }

    setError(false)
    setInFlight(true)

    // clone the project
    cloneProject(projectId, clonedProjectName)
      .then(data => {
        // open the cloned project
        openProject(data.project_id)
      })
      .catch(({ response, data }) => {
        if (response?.status === 400) {
          setError(data.message)
        } else {
          setError(true)
        }
      })
      .finally(() => {
        setInFlight(false)
      })
  }

  return (
    <CloneProjectModalContent
      show={show}
      cancel={cancel}
      inFlight={inFlight}
      valid={valid}
      error={error}
      clonedProjectName={clonedProjectName}
      setClonedProjectName={setClonedProjectName}
      handleSubmit={handleSubmit}
    />
  )
}

CloneProjectModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  projectName: PropTypes.string,
  openProject: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
}

export default CloneProjectModal
