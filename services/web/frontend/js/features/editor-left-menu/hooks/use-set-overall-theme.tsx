import { useCallback, useEffect } from 'react'
import _ from 'lodash'
import { saveUserSettings } from '../utils/api'
import { UserSettings } from '../../../../../types/user-settings'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import getMeta from '@/utils/meta'
import { isIEEEBranded } from '@/utils/is-ieee-branded'

export default function useSetOverallTheme() {
  const { userSettings, setUserSettings } = useUserSettingsContext()
  const { overallTheme } = userSettings

  const setOverallTheme = useCallback(
    (overallTheme: UserSettings['overallTheme']) => {
      setUserSettings(settings => ({ ...settings, overallTheme }))
    },
    [setUserSettings]
  )

  useEffect(() => {
    // Sets the body's data-theme attribute for theming
    const theme =
      overallTheme === 'light-' && !isIEEEBranded() ? 'light' : 'default'
    document.body.dataset.theme = theme
  }, [overallTheme])

  return useCallback(
    (newOverallTheme: UserSettings['overallTheme']) => {
      if (overallTheme !== newOverallTheme) {
        const chosenTheme = _.find(
          getMeta('ol-overallThemes'),
          theme => theme.val === newOverallTheme
        )

        if (chosenTheme) {
          setOverallTheme(newOverallTheme)
          saveUserSettings('overallTheme', newOverallTheme)
        }
      }
    },
    [overallTheme, setOverallTheme]
  )
}
