/**
 * This file is adapted from Lezer, licensed under the MIT license:
 * https://github.com/lezer-parser/highlight/blob/main/src/highlight.ts
 */
import { tagHighlighter, tags } from '@lezer/highlight'

export const classHighlighter = tagHighlighter([
  { tag: tags.link, class: 'tok-link' },
  { tag: tags.heading, class: 'tok-heading' },
  { tag: tags.emphasis, class: 'tok-emphasis' },
  { tag: tags.strong, class: 'tok-strong' },
  { tag: tags.keyword, class: 'tok-keyword' },
  { tag: tags.atom, class: 'tok-atom' },
  { tag: tags.bool, class: 'tok-bool' },
  { tag: tags.url, class: 'tok-url' },
  { tag: tags.labelName, class: 'tok-labelName' },
  { tag: tags.inserted, class: 'tok-inserted' },
  { tag: tags.deleted, class: 'tok-deleted' },
  { tag: tags.literal, class: 'tok-literal' },
  { tag: tags.string, class: 'tok-string' },
  { tag: tags.number, class: 'tok-number' },
  {
    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
    class: 'tok-string2',
  },
  { tag: tags.variableName, class: 'tok-variableName' },
  { tag: tags.local(tags.variableName), class: 'tok-variableName tok-local' },
  {
    tag: tags.definition(tags.variableName),
    class: 'tok-variableName tok-definition',
  },
  { tag: tags.special(tags.variableName), class: 'tok-variableName2' },
  {
    tag: tags.definition(tags.propertyName),
    class: 'tok-propertyName tok-definition',
  },
  { tag: tags.typeName, class: 'tok-typeName' },
  { tag: tags.namespace, class: 'tok-namespace' },
  { tag: tags.className, class: 'tok-className' },
  { tag: tags.macroName, class: 'tok-macroName' },
  { tag: tags.propertyName, class: 'tok-propertyName' },
  { tag: tags.operator, class: 'tok-operator' },
  { tag: tags.comment, class: 'tok-comment' },
  { tag: tags.meta, class: 'tok-meta' },
  { tag: tags.invalid, class: 'tok-invalid' },
  { tag: tags.punctuation, class: 'tok-punctuation' },
  // additional
  { tag: tags.attributeValue, class: 'tok-attributeValue' },
])
