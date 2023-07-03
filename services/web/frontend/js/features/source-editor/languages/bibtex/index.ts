import { LanguageSupport, indentUnit } from '@codemirror/language'
import { BibTeXLanguage } from './bibtex-language'

export const bibtex = () => {
  return new LanguageSupport(BibTeXLanguage, [
    indentUnit.of('    '), // 4 spaces
  ])
}
