import { memo } from 'react'
import WordCountModalContent from './word-count-modal-content'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { OLModal } from '@/shared/components/ol/ol-modal'
import { useFeatureFlag } from '@/shared/context/split-test-context'

const WordCountModal = memo(function WordCountModal({
  show,
  handleHide,
}: {
  show: boolean
  handleHide: () => void
}) {
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal
      animation
      show={show}
      onHide={handleHide}
      id="word-count-modal"
      data-testid="word-count-modal"
      initialFocus={false}
      themed={themed}
    >
      <WordCountModalContent handleHide={handleHide} />
    </OLModal>
  )
})

export default withErrorBoundary(WordCountModal)
