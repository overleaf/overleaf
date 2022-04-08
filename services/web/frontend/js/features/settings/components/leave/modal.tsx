import { useState, useCallback } from 'react'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import LeaveModalContent from './modal-content'

type LeaveModalProps = {
  isOpen: boolean
  handleClose: () => void
}

function LeaveModal({ isOpen, handleClose }: LeaveModalProps) {
  const [inFlight, setInFlight] = useState(false)

  const handleHide = useCallback(() => {
    if (!inFlight) {
      handleClose()
    }
  }, [handleClose, inFlight])

  return (
    <AccessibleModal
      animation
      show={isOpen}
      onHide={handleHide}
      id="leave-modal"
      backdrop="static"
    >
      <LeaveModalContent
        handleHide={handleHide}
        inFlight={inFlight}
        setInFlight={setInFlight}
      />
    </AccessibleModal>
  )
}

export default LeaveModal
