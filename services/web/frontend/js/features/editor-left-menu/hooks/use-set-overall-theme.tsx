import { useCallback, useEffect, useState } from 'react'
import _ from 'lodash'
import { OverallTheme } from '../../../../../modules/source-editor/frontend/js/extensions/theme'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { OverallThemeMeta } from '../../../../../types/project-settings'
import { saveUserSettings } from '../utils/api'

export default function useSetOverallTheme() {
  const [loadingStyleSheet, setLoadingStyleSheet] = useScopeValue<boolean>('ui.loadingStyleSheet')
  const [chosenTheme, setChosenTheme] = useState<OverallThemeMeta | null>(null)
  const [overallThemeScope, setOverallThemeScope] = useScopeValue<OverallTheme>(
    'settings.overallTheme'
  )

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

  const setOverallTheme = useCallback(
    (overallTheme: OverallTheme) => {
      if (overallThemeScope !== overallTheme) {
        const chosenTheme = _.find(
          window.overallThemes,
          theme => theme.val === overallTheme
        )

        if (chosenTheme) {
          setLoadingStyleSheet(true)
          setChosenTheme(chosenTheme)
          setOverallThemeScope(overallTheme)
          saveUserSettings({ overallTheme })
        }
      }
    },
    [overallThemeScope, setLoadingStyleSheet, setOverallThemeScope]
  )

  return setOverallTheme
}
