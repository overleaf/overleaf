import OLNotification from '@/features/ui/components/ol/ol-notification'

export default function DangerMessage({
  children,
}: {
  children: React.ReactNode
}) {
  return <OLNotification type="error" content={children} />
}
