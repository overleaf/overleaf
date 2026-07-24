import FocusTrap from '../focus-trap'
import { Offcanvas, OffcanvasProps } from 'react-bootstrap'
import type { Options as FocusTrapOptions } from 'focus-trap'
import classNames from 'classnames'

type OLOffcanvasProps = OffcanvasProps & {
  onHide: () => void
  show?: boolean
  className?: string
} & Pick<
    FocusTrapOptions,
    | 'escapeDeactivates'
    | 'clickOutsideDeactivates'
    | 'returnFocusOnDeactivate'
    | 'initialFocus'
  >

export function OLOffcanvas({
  children,
  show = false,
  onHide,
  returnFocusOnDeactivate = true,
  escapeDeactivates = false,
  clickOutsideDeactivates = true,
  initialFocus,
  className,
  backdropClassName,
  ...props
}: OLOffcanvasProps) {
  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      className={classNames(className)}
      backdropClassName={classNames(backdropClassName)}
      {...props}
    >
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
    </Offcanvas>
  )
}
