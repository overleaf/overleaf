import React from 'react'
import DictionaryModalContent from './dictionary-modal-content'
import AccessibleModal from '../../../shared/components/accessible-modal'
import withErrorBoundary from '../../../infrastructure/error-boundary'

type DictionaryModalProps = {
  show?: boolean
  handleHide: () => void
}

function DictionaryModal({ show, handleHide }: DictionaryModalProps) {
  return (
    <AccessibleModal
      animation
      show={show}
      onHide={handleHide}
      id="dictionary-modal"
      bsSize="small"
    >
      <DictionaryModalContent handleHide={handleHide} />
    </AccessibleModal>
  )
}

export default withErrorBoundary(DictionaryModal)
