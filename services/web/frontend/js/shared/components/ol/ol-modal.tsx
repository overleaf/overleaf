import {
  Modal,
  ModalProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalFooterProps,
} from 'react-bootstrap'
import { ModalBodyProps } from 'react-bootstrap/ModalBody'

type OLModalProps = ModalProps & {
  size?: 'sm' | 'lg'
  onHide: () => void
}

type OLModalHeaderProps = ModalHeaderProps & {
  closeButton?: boolean
}

export function OLModal({ children, ...props }: OLModalProps) {
  return <Modal {...props}>{children}</Modal>
}

export function OLModalHeader({
  children,
  closeButton = true,
  ...props
}: OLModalHeaderProps) {
  return (
    <Modal.Header closeButton={closeButton} {...props}>
      {children}
    </Modal.Header>
  )
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
