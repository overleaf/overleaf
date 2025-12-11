import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { OverallTheme } from '@/shared/utils/styles'
import { isIEEEBranded } from '@/utils/is-ieee-branded'
import { useEffect, useMemo, useState } from 'react'
import { useSplitTestContext } from '../context/split-test-context'

export type ActiveOverallTheme = 'dark' | 'light'

function getTheme(
  overallTheme: OverallTheme,
  prefersDark: boolean
): ActiveOverallTheme {
  if (isIEEEBranded()) {
    return 'dark'
  }
  if (overallTheme === 'light-') {
    return 'light'
  }
  if (overallTheme === 'system') {
    return prefersDark ? 'dark' : 'light'
  }
  return 'dark'
}

export const useActiveOverallTheme = (
  featureFlag?: string
): ActiveOverallTheme => {
  const { splitTestVariants } = useSplitTestContext()
  const [browserPrefersDarkMode, setBrowserPrefersDarkMode] = useState(() =>
    // If matchMedia is not supported, use the default (dark) theme
    {
      return (
        window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true
      )
    }
  )
  const {
    userSettings: { overallTheme },
  } = useUserSettingsContext()

  const activeOverallTheme = useMemo<ActiveOverallTheme>(() => {
    // Override theme if feature flag is provided and not enabled
    if (featureFlag && splitTestVariants[featureFlag] !== 'enabled') {
      return 'light'
    }

    return getTheme(overallTheme, browserPrefersDarkMode)
  }, [overallTheme, browserPrefersDarkMode, featureFlag, splitTestVariants])

  useEffect(() => {
    const mediaWatcher = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mediaWatcher) return

    const listener = (e: MediaQueryListEvent) => {
      setBrowserPrefersDarkMode(e.matches)
    }
    mediaWatcher.addEventListener('change', listener)
    return () => {
      mediaWatcher.removeEventListener('change', listener)
    }
  }, [])

  return activeOverallTheme
}
