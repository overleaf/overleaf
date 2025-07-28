import { tags, styleTags } from '@lezer/highlight'
import { TypstParser } from 'codemirror-lang-typst'
import {
  HighlightStyle,
  LanguageSupport,
  Language,
  syntaxHighlighting,
  defineLanguageFacet,
} from '@codemirror/language'

import { shortcuts } from './shortcuts'
import { typstLinter } from './linter'

export const typstHighlight = styleTags({
  "Shebang": tags.documentMeta,
  "LineComment BlockComment": tags.comment,

  "Text": tags.content,
  // "Space": typstTags["Space"],
  "Linebreak": tags.contentSeparator,
  // "ParBreak": typstTags["ParBreak"],
  "Escape": tags.escape,
  "Shorthand": tags.contentSeparator,
  "SmartQuote": tags.quote,
  "Strong/...": tags.strong,
  "Emph/...": tags.emphasis,
  "RawLang": tags.annotation,
  "RawDelim": tags.controlKeyword,
  "Raw": tags.monospace,
  // RawTrimmed
  "Link": tags.link,
  "Label": tags.labelName,
  "Ref/...": tags.labelName,
  "Heading/...": tags.heading,
  // HeadingMarker
  // "ListItem/...": tags.list,
  // "EnumItem/...": tags.list,
  "ListMarker": tags.list,
  "EnumMarker": tags.list,
  // "TermItem/...": tag,
  "TermMarker": tags.definitionOperator,
  // "Equation": typstTags["Equation"],

  // "Math": typstTags["Math"],
  "MathText": tags.special(tags.string),
  "MathIdent": tags.special(tags.variableName),
  "MathShorthand MathAlignPoint MathDelimited MathAttach MathPrimes MathFrac MathRoot": tags.special(tags.contentSeparator),

  "Error": tags.invalid,

  "Hash": tags.controlKeyword,
  "LeftBrace RightBrace": tags.brace,
  "LeftBracket RightBracket": tags.bracket,
  "LeftParen RightParen": tags.paren,
  "Comma": tags.separator,
  "Semicolon Colon Dot Dots": tags.punctuation,
  // "Star" : TODO:
  // Underscore
  "Dollar": tags.controlKeyword,
  "Plus Minus Slash Hat": tags.arithmeticOperator,
  "Prime": tags.typeOperator,
  "Eq PlusEq HyphEq SlashEq StarEq": tags.updateOperator,
  "EqEq ExclEq Lt LtEq Gt GtEq": tags.compareOperator,
  "Arrow": tags.controlOperator,
  "Root": tags.arithmeticOperator,

  "Not And Or": tags.operatorKeyword,
  "None Auto": tags.literal,
  "If Else For While Break Continue Return": tags.controlKeyword,
  "Import Include": tags.moduleKeyword,
  "Let Set Show Context": tags.definitionKeyword,
  "As In": tags.operatorKeyword,

  "Code": tags.monospace,
  "Ident": tags.variableName,
  "Bool": tags.bool,
  "Int": tags.integer,
  "Float": tags.float,
  "Numeric": tags.number,
  "Str": tags.string,
  // CodeBlock
  // ContentBlock
  // Parenthesized
  // Array
  // Dict
  // Named
  // Keyed
  // Unary
  // Binary
  // FieldAccess
  // FuncCall
  // Args
  // Spread
  // Closure
  // Params
  // LetBinding
  // SetRule
  // ShowRule
  // Contextual
  // Conditional
  // WhileLoop
  // ForLoop
  // ModuleImport
  // ImportItems
  // ImportItemPath
  // RenamedImportItem
  // ModuleInclude
  // LoopBreak
  // LoopContinue
  // FuncReturn
  // Destructuring
  // DestructAssignment
})


const data = defineLanguageFacet({ commentTokens: { block: { open: "/*", close: "*/" } } })

export const TypstHighlightSytle = HighlightStyle.define([
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', textDecoration: 'underline' },
  { tag: tags.processingInstruction, color: "fuchsia" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.literal, fontWeight: 'bold' },
  { tag: tags.punctuation, fontWeight: 'bold' },
  { tag: tags.controlKeyword, fontWeight: 'bold' },
  { tag: tags.annotation, fontWeight: 'bold' },
  { tag: tags.moduleKeyword, fontWeight: 'bold' },
  { tag: tags.operatorKeyword, fontWeight: 'bold' },
  { tag: tags.definitionKeyword, fontWeight: 'bold' },
  { tag: tags.contentSeparator, fontWeight: 'bold' },
  { tag: tags.definitionOperator, fontWeight: 'bold' },
  { tag: tags.list, fontWeight: 'bold' },
  { tag: tags.special(tags.contentSeparator), fontWeight: 'bolder' },
  { tag: tags.labelName, textDecoration: 'dotted blue underline', fontWeight: 'bold' },
  { tag: tags.monospace, fontFamily: "monospace", },
])

export function typst(): LanguageSupport {
  let parser = new TypstParser(typstHighlight);
  let updateListener = parser.updateListener();
  return new LanguageSupport(new Language(data, parser,
    [
      updateListener,
      syntaxHighlighting(TypstHighlightSytle),
      shortcuts(),
      typstLinter()
    ], 'typst'))
}