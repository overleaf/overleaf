import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import { shortcuts } from './shortcuts'
import { languages } from '../index'
import { Extension } from '@codemirror/state'
import { Strikethrough } from '@lezer/markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const markdown = (): Extension => {
  return [
    markdownLanguage({
      codeLanguages: languages,
      extensions: [Strikethrough],
    }),
    shortcuts(),
    syntaxHighlighting(markdownHighlightStyle),
  ]
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.heading, textDecoration: 'underline', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
])
