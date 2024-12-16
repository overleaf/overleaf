import { useCallback, useEffect, useState } from 'react'
import _ from 'lodash'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import type { OverallThemeMeta } from '../../../../../types/project-settings'
import { saveUserSettings } from '../utils/api'
import { UserSettings } from '../../../../../types/user-settings'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import getMeta from '@/utils/meta'
import { isBootstrap5 } from '@/features/utils/bootstrap-5'
import { isIEEEBranded } from '@/utils/is-ieee-branded'

export default function useSetOverallTheme() {
  const [chosenTheme, setChosenTheme] = useState<OverallThemeMeta | null>(null)
  const [loadingStyleSheet, setLoadingStyleSheet] = useScopeValue<boolean>(
    'ui.loadingStyleSheet'
  )

  const { userSettings, setUserSettings } = useUserSettingsContext()
  const { overallTheme } = userSettings

  const setOverallTheme = useCallback(
    (overallTheme: UserSettings['overallTheme']) => {
      setUserSettings(settings => ({ ...settings, overallTheme }))
    },
    [setUserSettings]
  )

  const skipLoadingStyleSheet = isBootstrap5()

  useEffect(() => {
    // Sets `data-theme` attribute to the body element, needed for Bootstrap 5 theming
    const theme =
      overallTheme === 'light-' && !isIEEEBranded() ? 'light' : 'default'
    document.body.dataset.theme = theme
  }, [overallTheme])

  useEffect(() => {
    if (skipLoadingStyleSheet) {
      return
    }

    const docHeadEl = document.querySelector('head')
    const oldStyleSheetEl = document.getElementById('main-stylesheet')

    const newStyleSheetEl = document.createElement('link')
    newStyleSheetEl.setAttribute('rel', 'stylesheet')
    newStyleSheetEl.setAttribute('id', 'main-stylesheet')
    newStyleSheetEl.setAttribute('href', chosenTheme?.path ?? '')

    const loadEventCallback = () => {
      setLoadingStyleSheet(false)

      if (docHeadEl && oldStyleSheetEl) {
        docHeadEl.removeChild(oldStyleSheetEl)
      }
    }

    if (loadingStyleSheet) {
      newStyleSheetEl.addEventListener('load', loadEventCallback, {
        once: true,
      })

      docHeadEl?.appendChild(newStyleSheetEl)
    }

    return () => {
      newStyleSheetEl.removeEventListener('load', loadEventCallback)
    }
  }, [
    loadingStyleSheet,
    setLoadingStyleSheet,
    skipLoadingStyleSheet,
    chosenTheme?.path,
  ])

  return useCallback(
    (newOverallTheme: UserSettings['overallTheme']) => {
      if (overallTheme !== newOverallTheme) {
        const chosenTheme = _.find(
          getMeta('ol-overallThemes'),
          theme => theme.val === newOverallTheme
        )

        if (chosenTheme) {
          if (!skipLoadingStyleSheet) {
            setLoadingStyleSheet(true)
          }
          setChosenTheme(chosenTheme)
          setOverallTheme(newOverallTheme)
          saveUserSettings('overallTheme', newOverallTheme)
        }
      }
    },
    [overallTheme, setLoadingStyleSheet, skipLoadingStyleSheet, setOverallTheme]
  )
}
