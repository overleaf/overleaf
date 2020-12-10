import React from 'react'
import { Modal } from 'react-bootstrap'
import PropTypes from 'prop-types'
import HotkeysModalContent from './hotkeys-modal-content'

function HotkeysModal({ handleHide, show, trackChangesVisible = false }) {
  const isMac = /Mac/i.test(navigator.platform)

  return (
    <Modal bsSize="large" onHide={handleHide} show={show}>
      <HotkeysModalContent
        handleHide={handleHide}
        isMac={isMac}
        trackChangesVisible={trackChangesVisible}
      />
    </Modal>
  )
}

HotkeysModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  trackChangesVisible: PropTypes.bool
}

export default HotkeysModal
