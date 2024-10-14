import {
  Modal as BS5Modal,
  ModalProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalBody,
  ModalFooterProps,
} from 'react-bootstrap-5'
import {
  Modal as BS3Modal,
  ModalProps as BS3ModalProps,
  ModalHeaderProps as BS3ModalHeaderProps,
  ModalTitleProps as BS3ModalTitleProps,
  ModalBodyProps as BS3ModalBodyProps,
  ModalFooterProps as BS3ModalFooterProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import AccessibleModal from '@/shared/components/accessible-modal'

type OLModalProps = ModalProps & {
  bs3Props?: Record<string, unknown>
  size?: 'sm' | 'lg'
  onHide: () => void
}

type OLModalHeaderProps = ModalHeaderProps & {
  bs3Props?: Record<string, unknown>
}

type OLModalTitleProps = ModalTitleProps & {
  bs3Props?: Record<string, unknown>
}

type OLModalBodyProps = React.ComponentProps<typeof ModalBody> & {
  bs3Props?: Record<string, unknown>
}

type OLModalFooterProps = ModalFooterProps & {
  bs3Props?: Record<string, unknown>
}

export default function OLModal({ children, ...props }: OLModalProps) {
  const { bs3Props, ...bs5Props } = props

  const bs3ModalProps: BS3ModalProps = {
    bsClass: bs5Props.bsPrefix,
    bsSize: bs5Props.size,
    show: bs5Props.show,
    onHide: bs5Props.onHide,
    onExited: bs5Props.onExited,
    backdrop: bs5Props.backdrop,
    animation: bs5Props.animation,
    id: bs5Props.id,
    className: bs5Props.className,
    backdropClassName: bs5Props.backdropClassName,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<AccessibleModal {...bs3ModalProps}>{children}</AccessibleModal>}
      bs5={<BS5Modal {...bs5Props}>{children}</BS5Modal>}
    />
  )
}

export function OLModalHeader({ children, ...props }: OLModalHeaderProps) {
  const { bs3Props, ...bs5Props } = props

  const bs3ModalProps: BS3ModalHeaderProps = {
    bsClass: bs5Props.bsPrefix,
    onHide: bs5Props.onHide,
    closeButton: bs5Props.closeButton,
    closeLabel: bs5Props.closeLabel,
  }
  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Modal.Header {...bs3ModalProps}>{children}</BS3Modal.Header>}
      bs5={<BS5Modal.Header {...bs5Props}>{children}</BS5Modal.Header>}
    />
  )
}

export function OLModalTitle({ children, ...props }: OLModalTitleProps) {
  const { bs3Props, ...bs5Props } = props

  const bs3ModalProps: BS3ModalTitleProps = {
    componentClass: bs5Props.as,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Modal.Title {...bs3ModalProps}>{children}</BS3Modal.Title>}
      bs5={
        <BS5Modal.Title as="h2" {...bs5Props}>
          {children}
        </BS5Modal.Title>
      }
    />
  )
}

export function OLModalBody({ children, ...props }: OLModalBodyProps) {
  const { bs3Props, ...bs5Props } = props

  const bs3ModalProps: BS3ModalBodyProps = {
    componentClass: bs5Props.as,
    className: bs5Props.className,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Modal.Body {...bs3ModalProps}>{children}</BS3Modal.Body>}
      bs5={<BS5Modal.Body {...bs5Props}>{children}</BS5Modal.Body>}
    />
  )
}

export function OLModalFooter({ children, ...props }: OLModalFooterProps) {
  const { bs3Props, ...bs5Props } = props

  const bs3ModalProps: BS3ModalFooterProps = {
    componentClass: bs5Props.as,
    className: bs5Props.className,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Modal.Footer {...bs3ModalProps}>{children}</BS3Modal.Footer>}
      bs5={<BS5Modal.Footer {...bs5Props}>{children}</BS5Modal.Footer>}
    />
  )
}
