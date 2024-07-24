import { useCallback } from 'react'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import useSetOverallTheme from './use-set-overall-theme'
import useSaveUserSettings from './use-save-user-settings'
import { UserSettings } from '../../../../../types/user-settings'

export default function useUserWideSettings() {
  const saveUserSettings = useSaveUserSettings()

  const { userSettings } = useUserSettingsContext()
  const {
    overallTheme,
    autoComplete,
    autoPairDelimiters,
    syntaxValidation,
    editorTheme,
    mode,
    fontSize,
    fontFamily,
    lineHeight,
    pdfViewer,
    mathPreview,
  } = userSettings

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

  const setMathPreview = useCallback(
    (mathPreview: UserSettings['mathPreview']) => {
      saveUserSettings('mathPreview', mathPreview)
    },
    [saveUserSettings]
  )

  return {
    autoComplete,
    setAutoComplete,
    autoPairDelimiters,
    setAutoPairDelimiters,
    syntaxValidation,
    setSyntaxValidation,
    editorTheme,
    setEditorTheme,
    overallTheme,
    setOverallTheme,
    mode,
    setMode,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    lineHeight,
    setLineHeight,
    pdfViewer,
    setPdfViewer,
    mathPreview,
    setMathPreview,
  }
}
