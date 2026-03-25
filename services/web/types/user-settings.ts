import { FontFamily, LineHeight, OverallTheme } from '@/shared/utils/styles'

export type Keybindings = 'none' | 'default' | 'vim' | 'emacs'
export type PdfViewer = 'pdfjs' | 'native'

export type RefProviderSettings = {
  enabled: boolean
  disablePersonalLibrary: boolean
  groups: { id: string }[]
  migrated?: boolean
}

export type UserSettings = {
  pdfViewer: PdfViewer
  autoComplete: boolean
  autoPairDelimiters: boolean
  syntaxValidation: boolean
  editorTheme: string
  editorLightTheme: string
  editorDarkTheme: string
  overallTheme: OverallTheme
  mode: Keybindings
  fontSize: number
  fontFamily: FontFamily
  lineHeight: LineHeight
  mathPreview: boolean
  referencesSearchMode: 'advanced' | 'simple'
  breadcrumbs: boolean
  darkModePdf: boolean
  zotero: RefProviderSettings
  mendeley: RefProviderSettings
  papers: RefProviderSettings
}
