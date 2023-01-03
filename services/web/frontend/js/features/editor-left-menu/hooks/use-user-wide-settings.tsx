import { useCallback } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import useSetOverallTheme from './use-set-overall-theme'
import useSaveUserSettings from './use-save-user-settings'
import type { UserSettingsScope } from '../utils/api'

export default function useUserWideSettings() {
  const saveUserSettings = useSaveUserSettings()

  // this may be undefined on test environments
  const [userSettings] = useScopeValue<UserSettingsScope | undefined>(
    'settings',
    true
  )

  const setOverallTheme = useSetOverallTheme()
  const setAutoComplete = useCallback(
    (autoComplete: UserSettingsScope['autoComplete']) => {
      saveUserSettings('autoComplete', autoComplete)
    },
    [saveUserSettings]
  )

  const setAutoPairDelimiters = useCallback(
    (autoPairDelimiters: UserSettingsScope['autoPairDelimiters']) => {
      saveUserSettings('autoPairDelimiters', autoPairDelimiters)
    },
    [saveUserSettings]
  )

  const setSyntaxValidation = useCallback(
    (syntaxValidation: UserSettingsScope['syntaxValidation']) => {
      saveUserSettings('syntaxValidation', syntaxValidation)
    },
    [saveUserSettings]
  )

  const setEditorTheme = useCallback(
    (editorTheme: UserSettingsScope['editorTheme']) => {
      saveUserSettings('editorTheme', editorTheme)
    },
    [saveUserSettings]
  )

  const setMode = useCallback(
    (mode: UserSettingsScope['mode']) => {
      saveUserSettings('mode', mode)
    },
    [saveUserSettings]
  )

  const setFontSize = useCallback(
    (fontSize: UserSettingsScope['fontSize']) => {
      saveUserSettings('fontSize', fontSize)
    },
    [saveUserSettings]
  )

  const setFontFamily = useCallback(
    (fontFamily: UserSettingsScope['fontFamily']) => {
      saveUserSettings('fontFamily', fontFamily)
    },
    [saveUserSettings]
  )

  const setLineHeight = useCallback(
    (lineHeight: UserSettingsScope['lineHeight']) => {
      saveUserSettings('lineHeight', lineHeight)
    },
    [saveUserSettings]
  )

  const setPdfViewer = useCallback(
    (pdfViewer: UserSettingsScope['pdfViewer']) => {
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
