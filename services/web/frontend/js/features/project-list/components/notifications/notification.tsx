import { useState } from 'react'
import { Alert, AlertProps } from 'react-bootstrap'
import Body from './body'
import Action from './action'
import classnames from 'classnames'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

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
      <Alert
        bsStyle={bsStyle}
        onDismiss={onDismiss ? handleDismiss : undefined}
        closeLabel={t('close')}
      >
        <div className="notification-entry-content">{children}</div>
      </Alert>
    </li>
  )
}

Notification.Body = Body
Notification.Action = Action

export default Notification
