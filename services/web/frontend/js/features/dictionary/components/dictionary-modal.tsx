import React from 'react'
import DictionaryModalContent from './dictionary-modal-content'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { OLModal } from '@/shared/components/ol/ol-modal'
import { useFeatureFlag } from '@/shared/context/split-test-context'

type DictionaryModalProps = {
  show?: boolean
  handleHide: () => void
}

function DictionaryModal({ show, handleHide }: DictionaryModalProps) {
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal
      animation
      show={show}
      onHide={handleHide}
      id="dictionary-modal"
      data-testid="dictionary-modal"
      size="sm"
      themed={themed}
    >
      <DictionaryModalContent handleHide={handleHide} />
    </OLModal>
  )
}

export default withErrorBoundary(DictionaryModal)
