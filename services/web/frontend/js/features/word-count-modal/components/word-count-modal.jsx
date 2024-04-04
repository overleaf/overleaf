import React from 'react'
import PropTypes from 'prop-types'
import WordCountModalContent from './word-count-modal-content'
import AccessibleModal from '../../../shared/components/accessible-modal'
import withErrorBoundary from '../../../infrastructure/error-boundary'

const WordCountModal = React.memo(function WordCountModal({
  show,
  handleHide,
}) {
  return (
    <AccessibleModal
      animation
      show={show}
      onHide={handleHide}
      id="word-count-modal"
    >
      <WordCountModalContent handleHide={handleHide} />
    </AccessibleModal>
  )
})

WordCountModal.propTypes = {
  show: PropTypes.bool,
  handleHide: PropTypes.func.isRequired,
}

export default withErrorBoundary(WordCountModal)
