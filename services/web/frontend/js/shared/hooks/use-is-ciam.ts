import { useSplitTestContext } from '@/shared/context/split-test-context'

export default function useIsCiam() {
  const { splitTestVariants } = useSplitTestContext()
  return splitTestVariants.uniaccessphase1 === 'enabled'
}
