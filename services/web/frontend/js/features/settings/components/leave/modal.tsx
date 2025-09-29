import { useState, useCallback } from 'react'
import LeaveModalContent from './modal-content'
import { OLModal } from '@/shared/components/ol/ol-modal'

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
    <OLModal animation show={isOpen} onHide={handleHide} id="leave-modal">
      <LeaveModalContent
        handleHide={handleHide}
        inFlight={inFlight}
        setInFlight={setInFlight}
      />
    </OLModal>
  )
}

export default LeaveModal
