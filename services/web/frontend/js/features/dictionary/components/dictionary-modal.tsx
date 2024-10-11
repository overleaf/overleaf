import React from 'react'
import DictionaryModalContent from './dictionary-modal-content'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import OLModal from '@/features/ui/components/ol/ol-modal'

type DictionaryModalProps = {
  show?: boolean
  handleHide: () => void
}

function DictionaryModal({ show, handleHide }: DictionaryModalProps) {
  return (
    <OLModal
      animation
      show={show}
      onHide={handleHide}
      id="dictionary-modal"
      size="sm"
    >
      <DictionaryModalContent handleHide={handleHide} />
    </OLModal>
  )
}

export default withErrorBoundary(DictionaryModal)
