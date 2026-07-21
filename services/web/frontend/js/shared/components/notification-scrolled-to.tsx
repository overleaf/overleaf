import Notification, {
  NotificationProps,
} from '@/shared/components/notification'
import { useEffect } from 'react'
import { elementIsInView } from '@/shared/utils/element-in-view'

function NotificationScrolledTo({ ...props }: NotificationProps) {
  useEffect(() => {
    if (props.id) {
      const alert = document.getElementById(props.id)
      if (alert && !elementIsInView(alert)) {
        alert.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [props])

  const notificationProps = { ...props }

  if (!notificationProps.className) {
    notificationProps.className = ''
  }

  notificationProps.className = `${notificationProps.className} notification-with-scroll-margin`

  return (
    <div className="notification-list">
      <Notification {...notificationProps} />
    </div>
  )
}
export default NotificationScrolledTo
