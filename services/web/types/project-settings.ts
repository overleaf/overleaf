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

export type OverallThemeMeta = {
  name: string
  path: string
  val: OverallTheme
}

export type SpellCheckLanguage = {
  name: string
  code: string
  dic?: string
  server?: false
}
