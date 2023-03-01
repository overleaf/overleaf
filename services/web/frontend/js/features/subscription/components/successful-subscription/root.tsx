import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import { SubscriptionDashboardProvider } from '../../context/subscription-dashboard-context'
import SuccessfulSubscription from './successful-subscription'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <SubscriptionDashboardProvider>
      <SuccessfulSubscription />
    </SubscriptionDashboardProvider>
  )
}

export default Root
