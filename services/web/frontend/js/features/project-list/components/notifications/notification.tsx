import classnames from 'classnames'
import BaseNotification from '@/shared/components/notification'

type NotificationProps = Pick<
  React.ComponentProps<typeof BaseNotification>,
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
    <BaseNotification isDismissible={props.onDismiss != null} {...props} />
  )

  return notificationComponent ? (
    <li className={classnames('notification-entry', className)}>
      {notificationComponent}
    </li>
  ) : null
}

export default Notification
