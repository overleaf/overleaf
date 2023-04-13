import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { shortcuts } from './shortcuts'
import { languages } from '../index'
import { Extension } from '@codemirror/state'

export const markdown = (): Extension => {
  return [
    markdownLanguage({
      codeLanguages: languages,
    }),
    shortcuts(),
    syntaxHighlighting(defaultHighlightStyle),
  ]
}
