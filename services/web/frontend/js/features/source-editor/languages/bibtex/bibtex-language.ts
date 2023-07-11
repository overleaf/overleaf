import { LRLanguage } from '@codemirror/language'
import { parser } from '../../lezer-bibtex/bibtex.mjs'
import { bibtexEntryCompletions } from './completions/snippets'

export const BibTeXLanguage = LRLanguage.define({
  name: 'bibtex',
  parser,
  languageData: {
    autocomplete: bibtexEntryCompletions,
  },
})
