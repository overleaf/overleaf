import Notification, {
  NotificationProps,
} from '@/shared/components/notification'
import classNames from 'classnames'
import { WarningCircle, Info } from '@phosphor-icons/react'

type DSNotificationProps = Pick<
  NotificationProps,
  'content' | 'customIcon' | 'className'
> & {
  type: 'info' | 'error'
}

function DSNotification(props: DSNotificationProps) {
  const { type, className, ...rest } = props
  const customIcon = type === 'info' ? <Info /> : <WarningCircle />

  return (
    <Notification
      type={type}
      customIcon={customIcon}
      className={classNames('notification-ds', className)}
      {...rest}
    />
  )
}

export default DSNotification
