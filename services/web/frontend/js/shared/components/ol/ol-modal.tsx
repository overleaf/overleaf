import FocusTrap from '../focus-trap'
import {
  Modal,
  ModalProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalFooterProps,
} from 'react-bootstrap'
import { ModalBodyProps } from 'react-bootstrap/ModalBody'
import type { Options as FocusTrapOptions } from 'focus-trap'
import { useTranslation } from 'react-i18next'

type OLModalProps = ModalProps & {
  size?: 'sm' | 'lg'
  onHide: () => void
  show?: boolean
} & Pick<
    FocusTrapOptions,
    | 'escapeDeactivates'
    | 'clickOutsideDeactivates'
    | 'returnFocusOnDeactivate'
    | 'initialFocus'
  >

type OLModalHeaderProps = ModalHeaderProps & {
  closeButton?: boolean
}

export function OLModal({
  children,
  show = false,
  onHide,
  returnFocusOnDeactivate = true, // Return focus to trigger element when modal closes
  escapeDeactivates = false, // Let React-Bootstrap Modal handle Escape key to avoid double Escape key handling
  clickOutsideDeactivates = true, // Allow focus trap to deactivate on outside click and let React-Bootstrap Modal handle it
  initialFocus,
  ...props
}: OLModalProps) {
  return (
    <Modal show={show} onHide={onHide} {...props}>
      <FocusTrap
        active={show}
        focusTrapOptions={{
          escapeDeactivates,
          clickOutsideDeactivates,
          returnFocusOnDeactivate,
          initialFocus,
        }}
      >
        {children}
      </FocusTrap>
    </Modal>
  )
}

export function OLModalHeader({
  children,
  closeButton = true,
  ...props
}: OLModalHeaderProps) {
  const { t } = useTranslation()
  return (
    <Modal.Header
      closeButton={closeButton}
      closeLabel={t('close_dialog')}
      {...props}
    >
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
