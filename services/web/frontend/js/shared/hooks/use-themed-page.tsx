import { useEffect } from 'react'
import { useActiveOverallTheme } from './use-active-overall-theme'

export default function useThemedPage(featureFlag?: string) {
  const activeOverallTheme = useActiveOverallTheme(featureFlag)

  useEffect(() => {
    // Sets the body's data-theme attribute for theming
    document.body.dataset.theme =
      activeOverallTheme === 'dark' ? 'default' : 'light'
  }, [activeOverallTheme])
}
