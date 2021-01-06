import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import PropTypes from 'prop-types'
import CloneProjectModalContent from './clone-project-modal-content'

function CloneProjectModal({ handleHide, show, projectId, projectName }) {
  const [inFlight, setInFlight] = useState(false)
  const [error, setError] = useState()

  // reset error when the modal is opened
  useEffect(() => {
    if (show) {
      setError(undefined)
    }
  }, [show])

  // clone the project when the form is submitted
  const cloneProject = useCallback(
    cloneName => {
      setInFlight(true)

      fetch(`/project/${projectId}/clone`, {
        method: 'POST',
        body: JSON.stringify({
          _csrf: window.csrfToken,
          projectName: cloneName
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(async response => {
          if (response.ok) {
            const { project_id: clonedProjectId } = await response.json()
            window.location.assign(`/project/${clonedProjectId}`)
          } else {
            if (response.status === 400) {
              setError({ message: await response.text() })
            } else {
              setError(true)
            }
            setInFlight(false)
          }
        })
        .catch(() => {
          setError(true)
          setInFlight(false)
        })
    },
    [projectId]
  )

  // close the modal if not in flight
  const cancel = useCallback(() => {
    if (!inFlight) {
      handleHide()
    }
  }, [handleHide, inFlight])

  return (
    <Modal show={show} onHide={cancel}>
      <CloneProjectModalContent
        cloneProject={cloneProject}
        error={error}
        cancel={cancel}
        inFlight={inFlight}
        projectName={projectName}
      />
    </Modal>
  )
}

CloneProjectModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  projectName: PropTypes.string,
  show: PropTypes.bool.isRequired
}

export default CloneProjectModal
