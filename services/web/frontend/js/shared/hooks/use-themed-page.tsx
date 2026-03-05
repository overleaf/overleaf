import { useLayoutEffect } from 'react'
import { useActiveOverallTheme } from './use-active-overall-theme'

export default function useThemedPage(featureFlag?: string) {
  const activeOverallTheme = useActiveOverallTheme(featureFlag)

  useLayoutEffect(() => {
    // Sets the body's data-theme attribute for theming
    document.body.dataset.theme =
      activeOverallTheme === 'dark' ? 'default' : 'light'
  }, [activeOverallTheme])
}
