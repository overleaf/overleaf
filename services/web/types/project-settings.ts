import { Brand } from './helpers/brand'
import { OverallTheme } from '@/shared/utils/styles'

export type ImageName = {
  imageDesc: string
  imageName: string
  allowed: boolean
  rolling?: boolean
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
