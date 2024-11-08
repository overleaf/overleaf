import classNames from 'classnames'
import { FC, useCallback, useEffect, useRef } from 'react'

type ToastProps = {
  onClose?: () => void
  onExited?: () => void
  autohide?: boolean
  delay?: number
  show: boolean
  className?: string
}
export const Toast: FC<ToastProps> = ({
  children,
  delay = 5000,
  onClose,
  onExited,
  autohide,
  show,
  className,
}) => {
  const delayRef = useRef(delay)
  const onCloseRef = useRef(onClose)
  const onExitedRef = useRef(onExited)
  const shouldAutoHide = Boolean(autohide && show)

  const handleTimeout = useCallback(() => {
    if (shouldAutoHide) {
      onCloseRef.current?.()
      onExitedRef.current?.()
    }
  }, [shouldAutoHide])

  useEffect(() => {
    const timeout = window.setTimeout(handleTimeout, delayRef.current)
    return () => window.clearTimeout(timeout)
  }, [handleTimeout])

  if (!show) {
    return null
  }

  return (
    <div
      className={classNames('toast', show ? 'show' : 'hide', className)}
      aria-live="assertive"
      role="alert"
    >
      {children}
    </div>
  )
}
