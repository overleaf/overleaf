import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { OverallTheme } from '@/shared/utils/styles'
import { isIEEEBranded } from '@/utils/is-ieee-branded'
import { useEffect, useMemo, useState } from 'react'
import { useSplitTestContext } from '../context/split-test-context'

export type ActiveOverallTheme = 'dark' | 'light'

const mediaWatcher = window.matchMedia?.('(prefers-color-scheme: dark)') ?? {
  // If matchMedia is not supported, use the default (dark) theme
  matches: true,
  addEventListener: () => {},
  removeEventListener: () => {},
}

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
  const [browserPrefersDarkMode, setBrowserPrefersDarkMode] = useState(
    mediaWatcher.matches
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
