import { useCallback } from 'react'
import { Modal, ModalProps } from 'react-bootstrap'

// A wrapper for the v0.33 React Bootstrap Modal component,
// which ensures that the `aria-hidden` attribute is not set on the modal when it's visible,
// and that role="dialog" is not duplicated.
// https://github.com/react-bootstrap/react-bootstrap/issues/4790
// There are other ARIA attributes on these modals which could be improved,
// but this at least makes them accessible for tests.
function AccessibleModal(props: ModalProps) {
  const modalRef = useCallback(
    element => {
      const modalNode = element?._modal?.modalNode
      if (modalNode) {
        if (props.show) {
          modalNode.removeAttribute('role')
          modalNode.removeAttribute('aria-hidden')
        } else {
          // NOTE: possibly not ever used, as the modal is only rendered when shown
          modalNode.setAttribute('aria-hidden', 'true')
        }
      }
    },
    [props.show]
  )

  return <Modal {...props} ref={modalRef} />
}

export default AccessibleModal
