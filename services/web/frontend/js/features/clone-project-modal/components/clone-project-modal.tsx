import React, { memo, useCallback, useState } from 'react'
import CloneProjectModalContent from './clone-project-modal-content'
import { OLModal } from '@/shared/components/ol/ol-modal'
import { ClonedProject } from '../../../../../types/project/dashboard/api'
import { Tag } from '../../../../../app/src/Features/Tags/types'

function CloneProjectModal({
  show,
  handleHide,
  handleAfterCloned,
  projectId,
  projectName,
  projectTags,
}: {
  show: boolean
  handleHide: () => void
  handleAfterCloned: (clonedProject: ClonedProject, tags: Tag[]) => void
  projectId: string
  projectName: string
  projectTags: Tag[]
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

export default memo(CloneProjectModal)
