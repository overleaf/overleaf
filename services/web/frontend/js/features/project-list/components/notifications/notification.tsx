import { useState } from 'react'
import { Alert, AlertProps } from 'react-bootstrap'
import Body from './body'
import Action from './action'
import Close from '../../../../shared/components/close'
import classnames from 'classnames'
import NewNotification, {
  NotificationType,
} from '@/shared/components/notification'
import getMeta from '@/utils/meta'

type NotificationProps = {
  bsStyle: AlertProps['bsStyle']
  children?: React.ReactNode
  body?: React.ReactNode
  action?: React.ReactElement
  onDismiss?: AlertProps['onDismiss']
  className?: string
  newNotificationStyle?: boolean
}

/**
 * Renders either a legacy-styled notification using Boostrap `Alert`, or a new-styled notification using
 * the shared `Notification` component.
 *
 * The content of the notification is provided either with `children` (keeping backwards compatibility),
 * or a `body` prop (along with an optional `action`).
 *
 * When the content is provided via `body` prop the notification is rendered with the new Notification component
 * if `ol-newNotificationStyle` meta is set to true.
 */
function Notification({
  bsStyle,
  children,
  onDismiss,
  className,
  body,
  action,
  newNotificationStyle,
  ...props
}: NotificationProps) {
  newNotificationStyle =
    newNotificationStyle ??
    (getMeta('ol-newNotificationStyle', false) as boolean)

  const [show, setShow] = useState(true)

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss()
    }

    setShow(false)
  }

  if (!show) {
    return null
  }

  if (newNotificationStyle && body) {
    const newNotificationType = (
      bsStyle === 'danger' ? 'error' : bsStyle
    ) as NotificationType
    return (
      <li className={classnames('notification-entry', className)}>
        <NewNotification
          type={newNotificationType}
          isDismissible={onDismiss != null}
          onDismiss={handleDismiss}
          content={body as React.ReactElement}
          action={action}
        />
      </li>
    )
  }

  if (body) {
    return (
      <li className={classnames('notification-entry', className)} {...props}>
        <Alert bsStyle={bsStyle}>
          <Body>{body}</Body>
          {action && <Action>{action}</Action>}
          {onDismiss ? (
            <div className="notification-close">
              <Close onDismiss={handleDismiss} />
            </div>
          ) : null}
        </Alert>
      </li>
    )
  } else {
    return (
      <li className={classnames('notification-entry', className)} {...props}>
        <Alert bsStyle={bsStyle}>
          {children}
          {onDismiss ? (
            <div className="notification-close">
              <Close onDismiss={handleDismiss} />
            </div>
          ) : null}
        </Alert>
      </li>
    )
  }
}

Notification.Body = Body
Notification.Action = Action

export default Notification
