import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import { Modal } from 'react-bootstrap'

// a bootstrap Modal with its `aria-hidden` attribute removed. Visisble modals
// should not have their `aria-hidden` attribute set but that's a bug in our
// version of react-bootstrap.
function AccessibleModal({ show, ...otherProps }) {
  // use a callback ref to track the modal. This will re-run the function
  // when the element node or any of the dependencies are updated
  const setModalRef = useCallback(
    element => {
      if (!element) return

      const modalNode = element._modal && element._modal.modalNode
      if (!modalNode) return

      if (show) {
        modalNode.removeAttribute('aria-hidden')
      } else {
        modalNode.setAttribute('aria-hidden', 'true')
      }
    },
    // `show` is necessary as a dependency, but eslint thinks it is not
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show]
  )

  return <Modal show={show} {...otherProps} ref={setModalRef} />
}

AccessibleModal.propTypes = {
  show: PropTypes.bool
}

export default AccessibleModal
