import { useCallback } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import useSetOverallTheme from './use-set-overall-theme'
import useSaveUserSettings from './use-save-user-settings'
import type { UserSettings } from '../utils/api'

export default function useUserWideSettings() {
  const saveUserSettings = useSaveUserSettings()

  // this may be undefined on test environments
  const [userSettings] = useScopeValue<UserSettings | undefined>(
    'settings',
    true
  )

  const setOverallTheme = useSetOverallTheme()
  const setAutoComplete = useCallback(
    (autoComplete: UserSettings['autoComplete']) => {
      saveUserSettings('autoComplete', autoComplete)
    },
    [saveUserSettings]
  )

  const setAutoPairDelimiters = useCallback(
    (autoPairDelimiters: UserSettings['autoPairDelimiters']) => {
      saveUserSettings('autoPairDelimiters', autoPairDelimiters)
    },
    [saveUserSettings]
  )

  const setSyntaxValidation = useCallback(
    (syntaxValidation: UserSettings['syntaxValidation']) => {
      saveUserSettings('syntaxValidation', syntaxValidation)
    },
    [saveUserSettings]
  )

  const setEditorTheme = useCallback(
    (editorTheme: UserSettings['editorTheme']) => {
      saveUserSettings('editorTheme', editorTheme)
    },
    [saveUserSettings]
  )

  const setMode = useCallback(
    (mode: UserSettings['mode']) => {
      saveUserSettings('mode', mode)
    },
    [saveUserSettings]
  )

  const setFontSize = useCallback(
    (fontSize: UserSettings['fontSize']) => {
      saveUserSettings('fontSize', fontSize)
    },
    [saveUserSettings]
  )

  const setFontFamily = useCallback(
    (fontFamily: UserSettings['fontFamily']) => {
      saveUserSettings('fontFamily', fontFamily)
    },
    [saveUserSettings]
  )

  const setLineHeight = useCallback(
    (lineHeight: UserSettings['lineHeight']) => {
      saveUserSettings('lineHeight', lineHeight)
    },
    [saveUserSettings]
  )

  const setPdfViewer = useCallback(
    (pdfViewer: UserSettings['pdfViewer']) => {
      saveUserSettings('pdfViewer', pdfViewer)
    },
    [saveUserSettings]
  )

  return {
    autoComplete: userSettings?.autoComplete,
    setAutoComplete,
    autoPairDelimiters: userSettings?.autoPairDelimiters,
    setAutoPairDelimiters,
    syntaxValidation: userSettings?.syntaxValidation,
    setSyntaxValidation,
    editorTheme: userSettings?.editorTheme,
    setEditorTheme,
    overallTheme: userSettings?.overallTheme,
    setOverallTheme,
    mode: userSettings?.mode,
    setMode,
    fontSize: userSettings?.fontSize,
    setFontSize,
    fontFamily: userSettings?.fontFamily,
    setFontFamily,
    lineHeight: userSettings?.lineHeight,
    setLineHeight,
    pdfViewer: userSettings?.pdfViewer,
    setPdfViewer,
  }
}
