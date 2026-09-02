import Notification from '@/shared/components/notification'

export default function DangerMessage({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="notification-list">
      <Notification type="error" content={children} />
    </div>
  )
}
