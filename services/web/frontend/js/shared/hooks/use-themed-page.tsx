import { useLayoutEffect } from 'react'
import { useActiveOverallTheme } from './use-active-overall-theme'

export default function useThemedPage(featureFlag?: string) {
  const activeOverallTheme = useActiveOverallTheme(featureFlag)

  useLayoutEffect(() => {
    // Sets the body's data-theme attribute for theming
    document.body.dataset.theme =
      activeOverallTheme === 'dark' ? 'default' : 'light'
    // drop the server-rendered first-paint hint
    delete document.body.dataset.initialTheme
  }, [activeOverallTheme])
}
