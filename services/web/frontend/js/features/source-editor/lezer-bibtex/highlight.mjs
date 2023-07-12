import { styleTags, tags as t } from '@lezer/highlight'

export const highlighting = styleTags({
  LiteralString: t.string,
  'BracedString/...': t.string,
  Number: t.number,
  Identifier: t.name,
  'EntryName/...': t.keyword,
  FieldName: t.attributeName,
  Expression: t.attributeValue,
  '#': t.operator,
  StringKeyword: t.keyword,
  PreambleKeyword: t.keyword,
  CommentKeyword: t.keyword,
  CommentContents: t.comment,
  StringName: t.variableName,
  Other: t.comment,
})
