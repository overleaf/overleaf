import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import AddSeats from '@/features/group-management/components/add-seats/add-seats'
import { SplitTestProvider } from '@/shared/context/split-test-context'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <SplitTestProvider>
      <AddSeats />
    </SplitTestProvider>
  )
}

export default Root
