import React, { memo, useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import CloneProjectModalContent from './clone-project-modal-content'
import AccessibleModal from '../../../shared/components/accessible-modal'

function CloneProjectModal({
  show,
  handleHide,
  handleAfterCloned,
  projectId,
  projectName,
}) {
  const [inFlight, setInFlight] = useState(false)

  const onHide = useCallback(() => {
    if (!inFlight) {
      handleHide()
    }
  }, [handleHide, inFlight])

  return (
    <AccessibleModal
      animation
      show={show}
      onHide={onHide}
      id="clone-project-modal"
      backdrop="static"
    >
      <CloneProjectModalContent
        handleHide={onHide}
        inFlight={inFlight}
        setInFlight={setInFlight}
        handleAfterCloned={handleAfterCloned}
        projectId={projectId}
        projectName={projectName}
      />
    </AccessibleModal>
  )
}

CloneProjectModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  handleAfterCloned: PropTypes.func.isRequired,
  projectId: PropTypes.string,
  projectName: PropTypes.string,
}

export default memo(CloneProjectModal)
