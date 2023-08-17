import { LanguageSupport } from '@codemirror/language'
import { BibTeXLanguage } from './bibtex-language'

export const bibtex = () => {
  return new LanguageSupport(BibTeXLanguage)
}
