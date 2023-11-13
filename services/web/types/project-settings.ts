import { OverallTheme } from '../frontend/js/features/source-editor/extensions/theme'
import { Brand } from './helpers/brand'

export type AllowedImageName = {
  imageDesc: string
  imageName: string
}

export type DocId = Brand<string, 'DocId'>
export type MainDocument = {
  doc: {
    name: string
    id: DocId
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
