import { LRLanguage, foldNodeProp, foldInside } from '@codemirror/language'
import { parser } from '../../lezer-latex/latex.mjs'
import { styleTags, tags as t } from '@lezer/highlight'
import * as termsModule from '../../lezer-latex/latex.terms.mjs'
import { NodeProp } from '@lezer/common'
import {
  Tokens,
  commentIsOpenFold,
  findClosingFoldComment,
  getFoldRange,
} from '../../utils/tree-query'
import { closeBracketConfig } from './close-bracket-config'

const styleOverrides: Record<string, any> = {
  DocumentClassCtrlSeq: t.keyword,
  UsePackageCtrlSeq: t.keyword,
  CiteCtrlSeq: t.keyword,
  CiteStarrableCtrlSeq: t.keyword,
  RefCtrlSeq: t.keyword,
  RefStarrableCtrlSeq: t.keyword,
  LabelCtrlSeq: t.keyword,
}

const styleEntry = (token: string, defaultStyle: any) => {
  return [token, styleOverrides[token] || defaultStyle]
}

const Styles = {
  ctrlSeq: Object.fromEntries(
    Tokens.ctrlSeq.map(token => styleEntry(token, t.tagName))
  ),
  ctrlSym: Object.fromEntries(
    Tokens.ctrlSym.map(token => styleEntry(token, t.literal))
  ),
  envName: Object.fromEntries(
    Tokens.envName.map(token => styleEntry(token, t.attributeValue))
  ),
}

const typeMap: Record<string, string[]> = {
  PartCtrlSeq: ['$SectioningCommand'],
  ChapterCtrlSeq: ['$SectioningCommand'],
  SectionCtrlSeq: ['$SectioningCommand'],
  SubSectionCtrlSeq: ['$SectioningCommand'],
  SubSubSectionCtrlSeq: ['$SectioningCommand'],
  ParagraphCtrlSeq: ['$SectioningCommand'],
  SubParagraphCtrlSeq: ['$SectioningCommand'],
}

export const LaTeXLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      foldNodeProp.add({
        Comment: (node, state) => {
          if (commentIsOpenFold(node, state)) {
            const closingFoldNode = findClosingFoldComment(node, state)
            if (closingFoldNode) {
              return getFoldRange(node, closingFoldNode, state)
            }
          }
          return null
        },
        Group: foldInside,
        NonEmptyGroup: foldInside,
        TextArgument: foldInside,
        // TODO: Why isn't
        // `Content: node => node,`
        // enough? For some reason it doesn't work if there's a newline after
        // \section{a}, but works for \section{a}b
        $Environment: node => node.getChild('Content'),
        $SectioningCommand: node => {
          const BACKWARDS = -1
          const lastChild = node.resolveInner(node.to, BACKWARDS)
          const content = node.getChild('Content')
          if (!content) {
            return null
          }
          if (lastChild.type.is(termsModule.NewLine)) {
            // Ignore last newline for sectioning commands
            return { from: content!.from, to: lastChild.from }
          }
          if (lastChild.type.is(termsModule.Whitespace)) {
            // If the sectioningcommand is indented on a newline
            let sibling = lastChild.prevSibling
            while (sibling?.type.is(termsModule.Whitespace)) {
              sibling = sibling.prevSibling
            }
            if (sibling?.type.is(termsModule.NewLine)) {
              return { from: content!.from, to: sibling.from }
            }
          }
          if (lastChild.type.is(termsModule.BlankLine)) {
            // HACK: BlankLine can contain any number above 2 of \n's.
            // Include every one except for the last one
            return { from: content!.from, to: lastChild.to - 1 }
          }
          return content
        },
      }),
      // TODO: does this override groups defined in the grammar?
      NodeProp.group.add(type => {
        const types = []

        if (
          Tokens.ctrlSeq.includes(type.name) ||
          Tokens.ctrlSym.includes(type.name)
        ) {
          types.push('$CtrlSeq')
          if (Tokens.ctrlSym.includes(type.name)) {
            types.push('$CtrlSym')
          }
        } else if (Tokens.envName.includes(type.name)) {
          types.push('$EnvName')
        } else if (type.name.endsWith('Argument')) {
          types.push('$Argument')
        } else if (type.name.endsWith('Environment')) {
          types.push('$Environment')
        } else if (type.name.endsWith('Brace')) {
          types.push('$Brace')
        } else if (
          ['BracketMath', 'ParenMath', 'DollarMath'].includes(type.name)
        ) {
          types.push('$MathContainer')
        }

        if (type.name in typeMap) {
          types.push(...typeMap[type.name])
        }

        return types.length > 0 ? types : undefined
      }),
      styleTags({
        ...Styles.ctrlSeq,
        ...Styles.ctrlSym,
        ...Styles.envName,
        'HrefCommand/ShortTextArgument/ShortArg/...': t.link,
        'HrefCommand/UrlArgument/...': t.monospace,
        'CtrlSeq Csname': t.tagName,
        'DocumentClass/OptionalArgument/ShortOptionalArg/Normal':
          t.attributeValue,
        'DocumentClass/ShortTextArgument/ShortArg/Normal': t.typeName,
        Number: t.number,
        OpenBrace: t.brace,
        CloseBrace: t.brace,
        OpenBracket: t.squareBracket,
        CloseBracket: t.squareBracket,
        Dollar: t.string,
        Math: t.string,
        'Math/MathChar': t.string,
        'Math/MathSpecialChar': t.string,
        'Math/Number': t.string,
        'MathGroup/OpenBrace MathGroup/CloseBrace': t.string,
        'MathTextCommand/TextArgument/OpenBrace MathTextCommand/TextArgument/CloseBrace':
          t.string,
        'MathOpening/LeftCtrlSeq MathClosing/RightCtrlSeq MathCommand/CtrlSeq MathTextCommand/CtrlSeq':
          t.literal,
        MathDelimiter: t.literal,
        DoubleDollar: t.keyword,
        Comment: t.comment,
        'UsePackage/OptionalArgument/ShortOptionalArg/Normal': t.attributeValue,
        'UsePackage/ShortTextArgument/ShortArg/Normal': t.tagName,
        'LiteralArgContent VerbContent VerbatimContent LstInlineContent':
          t.string,
        'NewCommand/LiteralArgContent': t.typeName,
        'LabelArgument/ShortTextArgument/ShortArg/...': t.attributeValue,
        'RefArgument/ShortTextArgument/ShortArg/...': t.attributeValue,
        'BibKeyArgument/ShortTextArgument/ShortArg/...': t.attributeValue,
        'ShortTextArgument/ShortArg/Normal': t.monospace,
        'UrlArgument/LiteralArgContent': [t.attributeValue, t.url],
        'FilePathArgument/LiteralArgContent': t.attributeValue,
        'BareFilePathArgument/SpaceDelimitedLiteralArgContent':
          t.attributeValue,
        TrailingContent: t.comment,
        // TODO: t.strong, t.emphasis
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: '%' },
    closeBrackets: closeBracketConfig,
  },
})
