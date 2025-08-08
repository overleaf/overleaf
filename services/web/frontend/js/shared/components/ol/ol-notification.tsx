import Notification from '@/shared/components/notification'

function OLNotification(props: React.ComponentProps<typeof Notification>) {
  return (
    <div className="notification-list">
      <Notification {...props} />
    </div>
  )
}

export default OLNotification
