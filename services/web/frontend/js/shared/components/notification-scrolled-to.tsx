import Notification, {
  NotificationProps,
} from '@/shared/components/notification'
import { useEffect } from 'react'

function elementIsInView(el: HTMLElement) {
  const scroll = window.scrollY
  const boundsTop = el.getBoundingClientRect().top + scroll

  const viewport = {
    top: scroll,
    bottom: scroll + window.innerHeight,
  }

  const bounds = {
    top: boundsTop,
    bottom: boundsTop + el.clientHeight,
  }

  return (
    (bounds.bottom >= viewport.top && bounds.bottom <= viewport.bottom) ||
    (bounds.top <= viewport.bottom && bounds.top >= viewport.top)
  )
}

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
