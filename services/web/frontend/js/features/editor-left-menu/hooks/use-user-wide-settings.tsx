import { useCallback } from 'react'
import {
  FontFamily,
  LineHeight,
} from '../../../../../modules/source-editor/frontend/js/extensions/theme'
import { Keybindings, PdfViewer } from '../../../../../types/project-settings'
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
    (autoComplete: boolean) => {
      saveUserSettings('autoComplete', autoComplete)
    },
    [saveUserSettings]
  )

  const setAutoPairDelimiters = useCallback(
    (autoPairDelimiters: boolean) => {
      saveUserSettings('autoPairDelimiters', autoPairDelimiters)
    },
    [saveUserSettings]
  )

  const setSyntaxValidation = useCallback(
    (syntaxValidation: boolean) => {
      saveUserSettings('syntaxValidation', syntaxValidation)
    },
    [saveUserSettings]
  )

  const setEditorTheme = useCallback(
    (editorTheme: string) => {
      saveUserSettings('editorTheme', editorTheme)
    },
    [saveUserSettings]
  )

  const setMode = useCallback(
    (mode: Keybindings) => {
      saveUserSettings('mode', mode)
    },
    [saveUserSettings]
  )

  const setFontSize = useCallback(
    (fontSize: string) => {
      saveUserSettings('fontSize', fontSize)
    },
    [saveUserSettings]
  )

  const setFontFamily = useCallback(
    (fontFamily: FontFamily) => {
      saveUserSettings('fontFamily', fontFamily)
    },
    [saveUserSettings]
  )

  const setLineHeight = useCallback(
    (lineHeight: LineHeight) => {
      saveUserSettings('lineHeight', lineHeight)
    },
    [saveUserSettings]
  )

  const setPdfViewer = useCallback(
    (pdfViewer: PdfViewer) => {
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
