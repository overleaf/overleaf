import { memo } from 'react'
import WordCountModalContent from './word-count-modal-content'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import OLModal from '@/features/ui/components/ol/ol-modal'

const WordCountModal = memo(function WordCountModal({
  show,
  handleHide,
}: {
  show: boolean
  handleHide: () => void
}) {
  return (
    <OLModal
      animation
      show={show}
      onHide={handleHide}
      id="word-count-modal"
      data-testid="word-count-modal"
    >
      <WordCountModalContent handleHide={handleHide} />
    </OLModal>
  )
})

export default withErrorBoundary(WordCountModal)
