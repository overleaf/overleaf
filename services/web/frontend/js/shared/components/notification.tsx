// to be kept in sync with app/views/_mixins/notification.pug

import classNames from 'classnames'
import React, { ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from './material-icon'

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'offer'

export type NotificationProps = {
  action?: React.ReactElement
  ariaLive?: 'polite' | 'off' | 'assertive'
  className?: string
  content: React.ReactNode
  customIcon?: React.ReactElement | null
  disclaimer?: React.ReactElement | string
  isDismissible?: boolean
  isActionBelowContent?: boolean
  onDismiss?: () => void
  title?: string
  type: NotificationType
  id?: string
}

export function NotificationIcon({
  notificationType,
  customIcon,
}: {
  notificationType: NotificationType
  customIcon?: ReactElement
}) {
  let icon = <MaterialIcon type="info" />

  if (customIcon) {
    icon = customIcon
  } else if (notificationType === 'success') {
    icon = <MaterialIcon type="check_circle" />
  } else if (notificationType === 'warning') {
    icon = <MaterialIcon type="warning" />
  } else if (notificationType === 'error') {
    icon = <MaterialIcon type="error" />
  } else if (notificationType === 'offer') {
    icon = <MaterialIcon type="campaign" />
  }
  return <div className="notification-icon">{icon}</div>
}

function Notification({
  action,
  ariaLive,
  className = '',
  content,
  customIcon,
  disclaimer,
  isActionBelowContent,
  isDismissible,
  onDismiss,
  title,
  type,
  id,
}: NotificationProps) {
  type = type || 'info'
  const { t } = useTranslation()
  const [show, setShow] = useState(true)

  const notificationClassName = classNames(
    'notification',
    `notification-type-${type}`,
    isActionBelowContent ? 'notification-cta-below-content' : '',
    className
  )

  const handleDismiss = () => {
    setShow(false)
    if (onDismiss) onDismiss()
  }

  // return null

  if (!show) {
    return null
  }

  return (
    <div
      className={notificationClassName}
      aria-live={ariaLive || 'off'}
      role="alert"
      id={id}
    >
      {customIcon !== null && (
        <NotificationIcon notificationType={type} customIcon={customIcon} />
      )}

      <div className="notification-content-and-cta">
        <div className="notification-content">
          {title && (
            <p>
              <b>{title}</b>
            </p>
          )}
          {content}
        </div>
        {action && <div className="notification-cta">{action}</div>}
        {disclaimer && (
          <div className="notification-disclaimer">{disclaimer}</div>
        )}
      </div>

      {isDismissible && (
        <div className="notification-close-btn">
          <button aria-label={t('close')} onClick={handleDismiss}>
            <MaterialIcon type="close" />
          </button>
        </div>
      )}
    </div>
  )
}

export default Notification
