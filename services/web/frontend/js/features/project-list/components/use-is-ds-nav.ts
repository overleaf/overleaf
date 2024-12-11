import { useSplitTestContext } from '@/shared/context/split-test-context'

export const useIsDsNav = () => {
  const { splitTestVariants } = useSplitTestContext()
  return splitTestVariants['sidebar-navigation-ui-update'] === 'active'
}
