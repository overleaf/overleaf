import { useCallback } from 'react'
import {
  FontFamily,
  LineHeight,
  OverallTheme,
} from '../../../../../modules/source-editor/frontend/js/extensions/theme'
import { Keybindings, PdfViewer } from '../../../../../types/project-settings'
import { postJSON } from '../../../infrastructure/fetch-json'
import useScopeValue from '../../../shared/hooks/use-scope-value'

type UserSettingsScope = {
  pdfViewer: PdfViewer
  autoComplete: boolean
  autoPairDelimiters: boolean
  syntaxValidation: boolean
  editorTheme: string
  overallTheme: OverallTheme
  mode: Keybindings
  fontSize: string
  fontFamily: FontFamily
  lineHeight: LineHeight
}

function saveUserSettings(data: Partial<UserSettingsScope>) {
  postJSON('/user/settings', {
    body: data,
  })
}

export default function useSetUserWideSettings() {
  const [userSettings, setUserSettings] = useScopeValue<UserSettingsScope>(
    'settings',
    true
  )

  const setAutoComplete = useCallback(
    (autoComplete: boolean) => {
      if (userSettings.autoComplete !== autoComplete) {
        setUserSettings({ ...userSettings, autoComplete })
        saveUserSettings({ autoComplete })
      }
    },
    [userSettings, setUserSettings]
  )

  const setAutoPairDelimiters = useCallback(
    (autoPairDelimiters: boolean) => {
      if (userSettings.autoPairDelimiters !== autoPairDelimiters) {
        setUserSettings({ ...userSettings, autoPairDelimiters })
        saveUserSettings({ autoPairDelimiters })
      }
    },
    [userSettings, setUserSettings]
  )

  const setSyntaxValidation = useCallback(
    (syntaxValidation: boolean) => {
      if (userSettings.syntaxValidation !== syntaxValidation) {
        setUserSettings({ ...userSettings, syntaxValidation })
        saveUserSettings({ syntaxValidation })
      }
    },
    [userSettings, setUserSettings]
  )

  const setEditorTheme = useCallback(
    (editorTheme: string) => {
      if (userSettings.editorTheme !== editorTheme) {
        setUserSettings({ ...userSettings, editorTheme })
        saveUserSettings({ editorTheme })
      }
    },
    [userSettings, setUserSettings]
  )

  // TODO: business logic
  const setOverallTheme = useCallback(
    (overallTheme: OverallTheme) => {
      if (userSettings.overallTheme !== overallTheme) {
        setUserSettings({ ...userSettings, overallTheme })
        saveUserSettings({ overallTheme })
      }
    },
    [userSettings, setUserSettings]
  )

  const setMode = useCallback(
    (mode: Keybindings) => {
      if (userSettings.mode !== mode) {
        setUserSettings({ ...userSettings, mode })
        saveUserSettings({ mode })
      }
    },
    [userSettings, setUserSettings]
  )

  const setFontSize = useCallback(
    (fontSize: string) => {
      if (userSettings.fontSize !== fontSize) {
        setUserSettings({ ...userSettings, fontSize })
        saveUserSettings({ fontSize })
      }
    },
    [userSettings, setUserSettings]
  )

  const setFontFamily = useCallback(
    (fontFamily: FontFamily) => {
      if (userSettings.fontFamily !== fontFamily) {
        setUserSettings({ ...userSettings, fontFamily })
        saveUserSettings({ fontFamily })
      }
    },
    [userSettings, setUserSettings]
  )

  const setLineHeight = useCallback(
    (lineHeight: LineHeight) => {
      if (userSettings.lineHeight !== lineHeight) {
        setUserSettings({ ...userSettings, lineHeight })
        saveUserSettings({ lineHeight })
      }
    },
    [userSettings, setUserSettings]
  )

  const setPdfViewer = useCallback(
    (pdfViewer: PdfViewer) => {
      if (userSettings.pdfViewer !== pdfViewer) {
        setUserSettings({ ...userSettings, pdfViewer })
        saveUserSettings({ pdfViewer })
      }
    },
    [userSettings, setUserSettings]
  )

  return {
    autoComplete: userSettings.autoComplete,
    setAutoComplete,
    autoPairDelimiters: userSettings.autoPairDelimiters,
    setAutoPairDelimiters,
    syntaxValidation: userSettings.syntaxValidation,
    setSyntaxValidation,
    editorTheme: userSettings.editorTheme,
    setEditorTheme,
    overallTheme: userSettings.overallTheme,
    setOverallTheme,
    mode: userSettings.mode,
    setMode,
    fontSize: userSettings.fontSize,
    setFontSize,
    fontFamily: userSettings.fontFamily,
    setFontFamily,
    lineHeight: userSettings.lineHeight,
    setLineHeight,
    pdfViewer: userSettings.pdfViewer,
    setPdfViewer,
  }
}
