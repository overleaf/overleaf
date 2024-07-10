import React, { memo, useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import CloneProjectModalContent from './clone-project-modal-content'
import OLModal from '@/features/ui/components/ol/ol-modal'

function CloneProjectModal({
  show,
  handleHide,
  handleAfterCloned,
  projectId,
  projectName,
  projectTags,
}) {
  const [inFlight, setInFlight] = useState(false)

  const onHide = useCallback(() => {
    if (!inFlight) {
      handleHide()
    }
  }, [handleHide, inFlight])

  return (
    <OLModal
      animation
      show={show}
      onHide={onHide}
      id="clone-project-modal"
      // backdrop="static" will disable closing the modal by clicking
      // outside of the modal element
      backdrop={inFlight ? 'static' : undefined}
    >
      <CloneProjectModalContent
        handleHide={onHide}
        inFlight={inFlight}
        setInFlight={setInFlight}
        handleAfterCloned={handleAfterCloned}
        projectId={projectId}
        projectName={projectName}
        projectTags={projectTags}
      />
    </OLModal>
  )
}

CloneProjectModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  handleAfterCloned: PropTypes.func.isRequired,
  projectId: PropTypes.string,
  projectName: PropTypes.string,
  projectTags: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string,
    })
  ),
}

export default memo(CloneProjectModal)
