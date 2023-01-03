import { createContext, useContext, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import useSetProjectWideSettings from '../hooks/use-set-project-wide-settings'
import useUserWideSettings from '../hooks/use-user-wide-settings'
import useProjectWideSettingsSocketListener from '../hooks/use-project-wide-settings-socket-listener'
import type { ProjectSettingsScope, UserSettingsScope } from '../utils/api'

type ProjectSettingsSetterContextValue = {
  setCompiler: (compiler: ProjectSettingsScope['compiler']) => void
  setImageName: (imageName: ProjectSettingsScope['imageName']) => void
  setRootDocId: (rootDocId: ProjectSettingsScope['rootDoc_id']) => void
  setSpellCheckLanguage: (
    spellCheckLanguage: ProjectSettingsScope['spellCheckLanguage']
  ) => void
  setAutoComplete: (autoComplete: UserSettingsScope['autoComplete']) => void
  setAutoPairDelimiters: (
    autoPairDelimiters: UserSettingsScope['autoPairDelimiters']
  ) => void
  setSyntaxValidation: (
    syntaxValidation: UserSettingsScope['syntaxValidation']
  ) => void
  setMode: (mode: UserSettingsScope['mode']) => void
  setEditorTheme: (editorTheme: UserSettingsScope['editorTheme']) => void
  setOverallTheme: (overallTheme: UserSettingsScope['overallTheme']) => void
  setFontSize: (fontSize: UserSettingsScope['fontSize']) => void
  setFontFamily: (fontFamily: UserSettingsScope['fontFamily']) => void
  setLineHeight: (lineHeight: UserSettingsScope['lineHeight']) => void
  setPdfViewer: (pdfViewer: UserSettingsScope['pdfViewer']) => void
}

type ProjectSettingsContextValue = Partial<ProjectSettingsScope> &
  Partial<UserSettingsScope> &
  ProjectSettingsSetterContextValue

export const ProjectSettingsContext = createContext<
  ProjectSettingsContextValue | undefined
>(undefined)

export function ProjectSettingsProvider({
  children,
}: PropsWithChildren<Record<string, never>>) {
  const {
    compiler,
    setCompiler,
    imageName,
    setImageName,
    rootDocId,
    setRootDocId,
    spellCheckLanguage,
    setSpellCheckLanguage,
  } = useSetProjectWideSettings()

  const {
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
  } = useUserWideSettings()

  useProjectWideSettingsSocketListener()

  const value: ProjectSettingsContextValue = useMemo(
    () => ({
      compiler,
      setCompiler,
      imageName,
      setImageName,
      rootDocId,
      setRootDocId,
      spellCheckLanguage,
      setSpellCheckLanguage,
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
    }),
    [
      compiler,
      setCompiler,
      imageName,
      setImageName,
      rootDocId,
      setRootDocId,
      spellCheckLanguage,
      setSpellCheckLanguage,
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
    ]
  )

  return (
    <ProjectSettingsContext.Provider value={value}>
      {children}
    </ProjectSettingsContext.Provider>
  )
}

export function useProjectSettingsContext() {
  const context = useContext(ProjectSettingsContext)

  if (!context) {
    throw new Error(
      'useProjectSettingsContext is only available inside ProjectSettingsProvider'
    )
  }

  return context
}
