import {
  Modal,
  ModalProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalFooterProps,
} from 'react-bootstrap-5'
import { ModalBodyProps } from 'react-bootstrap-5/ModalBody'

type OLModalProps = ModalProps & {
  size?: 'sm' | 'lg'
  onHide: () => void
}

export default function OLModal({ children, ...props }: OLModalProps) {
  return <Modal {...props}>{children}</Modal>
}

export function OLModalHeader({ children, ...props }: ModalHeaderProps) {
  return <Modal.Header {...props}>{children}</Modal.Header>
}

export function OLModalTitle({ children, ...props }: ModalTitleProps) {
  return (
    <Modal.Title as="h2" {...props}>
      {children}
    </Modal.Title>
  )
}

export function OLModalBody({ children, ...props }: ModalBodyProps) {
  return <Modal.Body {...props}>{children}</Modal.Body>
}

export function OLModalFooter({ children, ...props }: ModalFooterProps) {
  return <Modal.Footer {...props}>{children}</Modal.Footer>
}
