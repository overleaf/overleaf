import { UserProvider } from '@/shared/context/user-context'
import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import { SubscriptionDashboardProvider } from '../../context/subscription-dashboard-context'
import SuccessfulSubscription from './successful-subscription'
import { SplitTestProvider } from '@/shared/context/split-test-context'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <SplitTestProvider>
      <SubscriptionDashboardProvider>
        <UserProvider>
          <SuccessfulSubscription />
        </UserProvider>
      </SubscriptionDashboardProvider>
    </SplitTestProvider>
  )
}

export default Root
