import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import UpgradeSubscription from '@/features/group-management/components/upgrade-subscription/upgrade-subscription'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <UpgradeSubscription />
}

export default Root
