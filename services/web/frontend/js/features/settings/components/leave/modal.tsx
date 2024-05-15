import { useState, useCallback } from 'react'
import LeaveModalContent from './modal-content'
import OLModal from '@/features/ui/components/ol/ol-modal'

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
    <OLModal
      animation
      show={isOpen}
      onHide={handleHide}
      id="leave-modal"
      bs3Props={{ backdrop: 'static' }}
    >
      <LeaveModalContent
        handleHide={handleHide}
        inFlight={inFlight}
        setInFlight={setInFlight}
      />
    </OLModal>
  )
}

export default LeaveModal
