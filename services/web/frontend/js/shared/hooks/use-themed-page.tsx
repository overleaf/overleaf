import { useEffect } from 'react'
import { useActiveOverallTheme } from './use-active-overall-theme'
import { useSplitTestContext } from '../context/split-test-context'

export default function useThemedPage(featureFlag?: string) {
  const { splitTestVariants } = useSplitTestContext()

  let activeOverallTheme = useActiveOverallTheme()

  // Override theme if feature flag is provided and not enabled
  if (featureFlag && splitTestVariants[featureFlag] !== 'enabled') {
    activeOverallTheme = 'light'
  }

  useEffect(() => {
    // Sets the body's data-theme attribute for theming
    document.body.dataset.theme =
      activeOverallTheme === 'dark' ? 'default' : 'light'
  }, [activeOverallTheme])
}
