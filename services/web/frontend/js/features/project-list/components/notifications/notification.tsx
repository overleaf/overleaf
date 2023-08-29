import { useState } from 'react'
import { Alert, AlertProps } from 'react-bootstrap'
import Body from './body'
import Action from './action'
import Close from '../../../../shared/components/close'
import classnames from 'classnames'

type NotificationProps = {
  bsStyle: AlertProps['bsStyle']
  children: React.ReactNode
  onDismiss?: AlertProps['onDismiss']
  className?: string
}

function Notification({
  bsStyle,
  children,
  onDismiss,
  className,
  ...props
}: NotificationProps) {
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

Notification.Body = Body
Notification.Action = Action

export default Notification
