import React, { useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import CloneProjectModalContent from './clone-project-modal-content'
import AccessibleModal from '../../../shared/components/accessible-modal'
import withErrorBoundary from '../../../infrastructure/error-boundary'

const CloneProjectModal = React.memo(function CloneProjectModal({
  show,
  handleHide,
  openProject,
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
        openProject={openProject}
      />
    </AccessibleModal>
  )
})

CloneProjectModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  openProject: PropTypes.func.isRequired,
}

export default withErrorBoundary(CloneProjectModal)
