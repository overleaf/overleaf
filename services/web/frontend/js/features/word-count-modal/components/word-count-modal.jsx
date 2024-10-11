import React from 'react'
import PropTypes from 'prop-types'
import WordCountModalContent from './word-count-modal-content'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import OLModal from '@/features/ui/components/ol/ol-modal'

const WordCountModal = React.memo(function WordCountModal({
  show,
  handleHide,
}) {
  return (
    <OLModal animation show={show} onHide={handleHide} id="word-count-modal">
      <WordCountModalContent handleHide={handleHide} />
    </OLModal>
  )
})

WordCountModal.propTypes = {
  show: PropTypes.bool,
  handleHide: PropTypes.func.isRequired,
}

export default withErrorBoundary(WordCountModal)
