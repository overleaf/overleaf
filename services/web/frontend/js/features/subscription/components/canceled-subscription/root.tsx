import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import CanceledSubscription from './canceled'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <CanceledSubscription />
}

export default Root
