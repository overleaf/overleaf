import { SubscriptionDashboardProvider } from '../../context/subscription-dashboard-context'
import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import SubscriptionDashboard from './subscription-dashboard'
import { SplitTestProvider } from '@/shared/context/split-test-context'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <SplitTestProvider>
      <SubscriptionDashboardProvider>
        <SubscriptionDashboard />
      </SubscriptionDashboardProvider>
    </SplitTestProvider>
  )
}

export default Root
