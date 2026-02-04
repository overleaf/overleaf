import { indentNodeProp, LRLanguage } from '@codemirror/language'
import { parser } from '../../lezer-bibtex/bibtex.mjs'
import { bibtexEntryCompletions } from './completions/snippets'

export const BibTeXLanguage = LRLanguage.define({
  name: 'bibtex',
  parser: parser.configure({
    props: [
      // Disable the autoindent from delimited nodes
      indentNodeProp.add({
        EntryBody: () => null,
        StringBody: () => null,
        PreambleBody: () => null,
        CommentBody: () => null,
        StringLiteral: () => null,
      }),
    ],
  }),
  languageData: {
    autocomplete: bibtexEntryCompletions,
  },
})
