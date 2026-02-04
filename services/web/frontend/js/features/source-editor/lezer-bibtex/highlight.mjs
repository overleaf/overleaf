import { styleTags, tags as t } from '@lezer/highlight'

export const highlighting = styleTags({
  'EntryCommand/...': t.keyword,
  'StringCommand/...': t.keyword,
  'PreambleCommand/...': t.keyword,
  'CommentCommand/...': t.keyword,
  FieldName: t.name,
  CitationKey: t.name,
  'StringLiteral/...': t.string,
  NumberLiteral: t.number,
  StringName: t.variableName,
  '#': t.operator,
  Comment: t.comment,
  'CommentBody/...': t.comment,
  Junk: t.comment,
})
