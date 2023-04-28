import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import { shortcuts } from './shortcuts'
import { languages } from '../index'
import { Strikethrough } from '@lezer/markdown'
import {
  HighlightStyle,
  LanguageSupport,
  syntaxHighlighting,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const markdown = () => {
  const { language, support } = markdownLanguage({
    codeLanguages: languages,
    extensions: [Strikethrough],
  })

  return new LanguageSupport(language, [
    support,
    shortcuts(),
    syntaxHighlighting(markdownHighlightStyle),
  ])
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.heading, textDecoration: 'underline', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
])
