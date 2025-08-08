import classNames from 'classnames'
import { Toast as BS5Toast } from 'react-bootstrap'
import { NotificationIcon, NotificationType } from '../notification'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '../material-icon'
import { ReactNode, useCallback, useState } from 'react'

export type OLToastProps = {
  type: NotificationType
  className?: string
  title?: string
  content: string | ReactNode
  isDismissible?: boolean
  onDismiss?: () => void
  autoHide?: boolean
  delay?: number
}

export const OLToast = ({
  type = 'info',
  className = '',
  content,
  title,
  isDismissible,
  onDismiss,
  autoHide,
  delay,
}: OLToastProps) => {
  const { t } = useTranslation()
  const [show, setShow] = useState(true)

  const toastClassName = classNames(
    'notification',
    `notification-type-${type}`,
    className,
    'toast-content'
  )

  const handleClose = useCallback(() => {
    setShow(false)
  }, [])

  const handleOnHidden = useCallback(() => {
    if (onDismiss) onDismiss()
  }, [onDismiss])

  const toastElement = (
    <div className={toastClassName}>
      <NotificationIcon notificationType={type} />

      <div className="notification-content-and-cta">
        <div className="notification-content">
          {title && (
            <p>
              <b>{title}</b>
            </p>
          )}
          {content}
        </div>
      </div>

      {isDismissible && (
        <div className="notification-close-btn">
          <button
            aria-label={t('close')}
            data-bs-dismiss="toast"
            onClick={handleClose}
          >
            <MaterialIcon type="close" />
          </button>
        </div>
      )}
    </div>
  )
  return (
    <BS5Toast
      onClose={handleClose}
      autohide={autoHide}
      onExited={handleOnHidden}
      delay={delay}
      show={show}
    >
      {toastElement}
    </BS5Toast>
  )
}
