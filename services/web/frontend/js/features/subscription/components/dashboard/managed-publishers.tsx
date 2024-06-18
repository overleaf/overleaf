import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import ManagedPublisher from './managed-publisher'

export default function ManagedPublishers() {
  const { managedPublishers } = useSubscriptionDashboardContext()

  if (!managedPublishers) {
    return null
  }

  return (
    <>
      {managedPublishers.map(publisher => (
        <ManagedPublisher
          publisher={publisher}
          key={`managed-publisher-${publisher.slug}`}
        />
      ))}
    </>
  )
}
