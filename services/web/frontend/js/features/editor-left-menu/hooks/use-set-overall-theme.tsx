import { useCallback, useEffect, useState } from 'react'
import _ from 'lodash'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import type { OverallThemeMeta } from '../../../../../types/project-settings'
import { saveUserSettings, type UserSettings } from '../utils/api'

export default function useSetOverallTheme() {
  const [chosenTheme, setChosenTheme] = useState<OverallThemeMeta | null>(null)
  const [loadingStyleSheet, setLoadingStyleSheet] = useScopeValue<boolean>(
    'ui.loadingStyleSheet'
  )
  const [overallTheme, setOverallTheme] = useScopeValue<
    UserSettings['overallTheme']
  >('settings.overallTheme')

  useEffect(() => {
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
  }, [loadingStyleSheet, setLoadingStyleSheet, chosenTheme?.path])

  return useCallback(
    (newOverallTheme: UserSettings['overallTheme']) => {
      if (overallTheme !== newOverallTheme) {
        const chosenTheme = _.find(
          window.overallThemes,
          theme => theme.val === newOverallTheme
        )

        if (chosenTheme) {
          setLoadingStyleSheet(true)
          setChosenTheme(chosenTheme)
          setOverallTheme(newOverallTheme)
          saveUserSettings({ overallTheme: newOverallTheme })
        }
      }
    },
    [overallTheme, setLoadingStyleSheet, setOverallTheme]
  )
}
