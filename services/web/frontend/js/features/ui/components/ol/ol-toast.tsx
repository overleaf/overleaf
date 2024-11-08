import classNames from 'classnames'
import { Toast as BS5Toast } from 'react-bootstrap-5'
import {
  NotificationIcon,
  NotificationType,
} from '../../../../shared/components/notification'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '../../../../shared/components/material-icon'
import { ReactNode, useCallback, useState } from 'react'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { Toast as BS3Toast } from '../bootstrap-3/toast'

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
    <BootstrapVersionSwitcher
      bs5={
        <BS5Toast
          onClose={handleClose}
          autohide={autoHide}
          onExited={handleOnHidden}
          delay={delay}
          show={show}
        >
          {toastElement}
        </BS5Toast>
      }
      bs3={
        <BS3Toast
          onClose={handleClose}
          autohide={autoHide}
          delay={delay}
          onExited={handleOnHidden}
          show={show}
        >
          {toastElement}
        </BS3Toast>
      }
    />
  )
}
