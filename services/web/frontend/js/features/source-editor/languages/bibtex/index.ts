import { LanguageSupport } from '@codemirror/language'
import { BibTeXLanguage } from './bibtex-language'
import { bibtexLinter } from './linting'

export const bibtex = () => {
  return new LanguageSupport(BibTeXLanguage, [bibtexLinter()])
}
