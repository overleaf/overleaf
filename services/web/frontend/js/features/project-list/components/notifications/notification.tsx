import classnames from 'classnames'
import NewNotification from '@/shared/components/notification'

type NotificationProps = Pick<
  React.ComponentProps<typeof NewNotification>,
  | 'type'
  | 'action'
  | 'content'
  | 'onDismiss'
  | 'className'
  | 'title'
  | 'customIcon'
  | 'iconPlacement'
>

function Notification({ className, ...props }: NotificationProps) {
  const notificationComponent = (
    <NewNotification isDismissible={props.onDismiss != null} {...props} />
  )

  return notificationComponent ? (
    <li className={classnames('notification-entry', className)}>
      {notificationComponent}
    </li>
  ) : null
}

export default Notification
