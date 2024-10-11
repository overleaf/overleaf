import Notification from '@/shared/components/notification'
import { Alert, AlertProps } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import classnames from 'classnames'

type OLNotificationProps = React.ComponentProps<typeof Notification> & {
  bs3Props?: {
    icon?: React.ReactElement
    className?: string
  }
}

function OLNotification(props: OLNotificationProps) {
  const { bs3Props, ...notificationProps } = props

  const alertProps = {
    // Map `error` to `danger`
    bsStyle:
      notificationProps.type === 'error' ? 'danger' : notificationProps.type,
    className: classnames(notificationProps.className, bs3Props?.className),
    onDismiss: notificationProps.onDismiss,
  } as const satisfies AlertProps

  return (
    <BootstrapVersionSwitcher
      bs3={
        <Alert {...alertProps}>
          {bs3Props?.icon}
          {bs3Props?.icon && ' '}
          {notificationProps.content}
          {notificationProps.action}
        </Alert>
      }
      bs5={
        <div className="notification-list">
          <Notification {...notificationProps} />
        </div>
      }
    />
  )
}

export default OLNotification
