import { OverallTheme } from '../frontend/js/features/source-editor/extensions/theme'

export type AllowedImageName = {
  imageDesc: string
  imageName: string
}

export type MainDocument = {
  doc: {
    name: string
    id: string
    type: string
    selected: boolean
  }
  path: string
}

export type ProjectCompiler = 'pdflatex' | 'latex' | 'xelatex' | 'lualatex'

export type Keybindings = 'default' | 'vim' | 'emacs'

export type OverallThemeMeta = {
  name: string
  path: string
  val: OverallTheme
}

export type PdfViewer = 'pdfjs' | 'native'

export type SpellCheckLanguage = {
  name: string
  code: string
}
