/* Hand-written tokenizer for LaTeX. */

import { ExternalTokenizer, ContextTracker } from '@lezer/lr'

import {
  LiteralArgContent,
  SpaceDelimitedLiteralArgContent,
  VerbContent,
  VerbatimContent,
  LstInlineContent,
  Begin,
  End,
  KnownEnvironment,
  Csname,
  TrailingWhitespaceOnly,
  TrailingContent,
  RefCtrlSeq,
  RefStarrableCtrlSeq,
  CiteCtrlSeq,
  CiteStarrableCtrlSeq,
  LabelCtrlSeq,
  MathTextCtrlSeq,
  HboxCtrlSeq,
  TitleCtrlSeq,
  AuthorCtrlSeq,
  AffilCtrlSeq,
  AffiliationCtrlSeq,
  DateCtrlSeq,
  DocumentClassCtrlSeq,
  UsePackageCtrlSeq,
  HrefCtrlSeq,
  UrlCtrlSeq,
  VerbCtrlSeq,
  LstInlineCtrlSeq,
  IncludeGraphicsCtrlSeq,
  CaptionCtrlSeq,
  DefCtrlSeq,
  LetCtrlSeq,
  LeftCtrlSeq,
  RightCtrlSeq,
  NewCommandCtrlSeq,
  RenewCommandCtrlSeq,
  NewEnvironmentCtrlSeq,
  RenewEnvironmentCtrlSeq,
  DocumentEnvName,
  TabularEnvName,
  EquationEnvName,
  EquationArrayEnvName,
  VerbatimEnvName,
  TikzPictureEnvName,
  FigureEnvName,
  OpenParenCtrlSym,
  CloseParenCtrlSym,
  OpenBracketCtrlSym,
  CloseBracketCtrlSym,
  LineBreakCtrlSym,
  // Sectioning commands
  BookCtrlSeq,
  PartCtrlSeq,
  ChapterCtrlSeq,
  SectionCtrlSeq,
  SubSectionCtrlSeq,
  SubSubSectionCtrlSeq,
  ParagraphCtrlSeq,
  SubParagraphCtrlSeq,
  InputCtrlSeq,
  IncludeCtrlSeq,
  ItemCtrlSeq,
  NewTheoremCtrlSeq,
  TheoremStyleCtrlSeq,
  BibliographyCtrlSeq,
  BibliographyStyleCtrlSeq,
  CenteringCtrlSeq,
  ListEnvName,
  MaketitleCtrlSeq,
  TextColorCtrlSeq,
  ColorBoxCtrlSeq,
  HLineCtrlSeq,
  TopRuleCtrlSeq,
  MidRuleCtrlSeq,
  BottomRuleCtrlSeq,
  TableEnvName,
  MultiColumnCtrlSeq,
  ParBoxCtrlSeq,
  // Marker for end of argument lists
  endOfArguments,
  hasMoreArguments,
  hasMoreArgumentsOrOptionals,
  endOfArgumentsAndOptionals,
  TextBoldCtrlSeq,
  TextItalicCtrlSeq,
  TextSmallCapsCtrlSeq,
  TextTeletypeCtrlSeq,
  TextMediumCtrlSeq,
  TextSansSerifCtrlSeq,
  TextSuperscriptCtrlSeq,
  TextSubscriptCtrlSeq,
  TextStrikeOutCtrlSeq,
  EmphasisCtrlSeq,
  UnderlineCtrlSeq,
  SetLengthCtrlSeq,
} from './latex.terms.mjs'

const MAX_ARGUMENT_LOOKAHEAD = 100

function nameChar(ch) {
  // we accept A-Z a-z 0-9 * + @ in environment names
  return (
    (ch >= 65 && ch <= 90) ||
    (ch >= 97 && ch <= 122) ||
    (ch >= 48 && ch <= 57) ||
    ch === 42 ||
    ch === 43 ||
    ch === 64
  )
}

// match [a-zA-Z]
function alphaChar(ch) {
  return (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122)
}

let cachedName = null
let cachedInput = null
let cachedPos = 0
function envNameAfter(input, offset) {
  const pos = input.pos + offset
  if (cachedInput === input && cachedPos === pos) {
    return cachedName
  }
  if (input.peek(offset) !== '{'.charCodeAt(0)) return
  offset++
  let name = ''
  for (;;) {
    const next = input.peek(offset)
    if (!nameChar(next)) break
    name += String.fromCharCode(next)
    offset++
  }
  cachedInput = input
  cachedPos = pos
  return (cachedName = name || null)
}

function ElementContext(name, parent) {
  this.name = name
  this.parent = parent
  this.hash = parent ? parent.hash : 0
  for (let i = 0; i < name.length; i++)
    this.hash +=
      (this.hash << 4) + name.charCodeAt(i) + (name.charCodeAt(i) << 8)
}

export const elementContext = new ContextTracker({
  start: null,
  shift(context, term, stack, input) {
    return term === Begin
      ? new ElementContext(envNameAfter(input, '\\begin'.length) || '', context)
      : context
  },
  reduce(context, term) {
    return term === KnownEnvironment && context ? context.parent : context
  },
  reuse(context, node, _stack, input) {
    const type = node.type.id
    return type === Begin
      ? new ElementContext(envNameAfter(input, 0) || '', context)
      : context
  },
  hash(context) {
    return context ? context.hash : 0
  },
  strict: false,
})

// tokenizer for \verb|...| commands
export const verbTokenizer = new ExternalTokenizer(
  (input, stack) => {
    if (input.next === '*'.charCodeAt(0)) input.advance()
    const delimiter = input.next
    if (delimiter === -1) return // hit end of file
    if (/\s|\*/.test(String.fromCharCode(delimiter))) return // invalid delimiter
    input.advance()
    for (;;) {
      const next = input.next
      if (next === -1 || next === CHAR_NEWLINE) return
      input.advance()
      if (next === delimiter) break
    }
    return input.acceptToken(VerbContent)
  },
  { contextual: false }
)

// tokenizer for \lstinline|...| commands
export const lstinlineTokenizer = new ExternalTokenizer(
  (input, stack) => {
    let delimiter = input.next
    if (delimiter === -1) return // hit end of file
    if (/\s/.test(String.fromCharCode(delimiter))) {
      return // invalid delimiter
    }
    if (delimiter === CHAR_OPEN_BRACE) {
      delimiter = CHAR_CLOSE_BRACE
    }
    input.advance()
    for (;;) {
      const next = input.next
      if (next === -1 || next === CHAR_NEWLINE) return
      input.advance()
      if (next === delimiter) break
    }
    return input.acceptToken(LstInlineContent)
  },
  { contextual: false }
)

const matchForward = (input, expected, offset = 0) => {
  for (let i = 0; i < expected.length; i++) {
    if (String.fromCharCode(input.peek(offset + i)) !== expected[i]) {
      return false
    }
  }
  return true
}

// tokenizer for \begin{verbatim}...\end{verbatim} environments
export const verbatimTokenizer = new ExternalTokenizer(
  (input, stack) => {
    const delimiter = '\\end{' + stack.context.name + '}'
    for (let offset = 0; ; offset++) {
      const next = input.peek(offset)
      if (next === -1 || matchForward(input, delimiter, offset)) {
        return input.acceptToken(VerbatimContent, offset)
      }
    }
  },
  { contextual: false }
)

// tokenizer for \href{...} and similar commands
export const literalArgTokenizer = new ExternalTokenizer(
  input => {
    for (let offset = 0; ; offset++) {
      const next = input.peek(offset)
      if (next === -1 || next === CHAR_CLOSE_BRACE) {
        return input.acceptToken(LiteralArgContent, offset)
      }
    }
  },
  { contextual: false }
)

// tokenizer for literal content delimited by whitespace, such as in `\input foo.tex`
export const spaceDelimitedLiteralArgTokenizer = new ExternalTokenizer(
  input => {
    for (let offset = 0; ; offset++) {
      const next = input.peek(offset)
      if (next === -1 || next === CHAR_SPACE || next === CHAR_NEWLINE) {
        return input.acceptToken(SpaceDelimitedLiteralArgContent, offset)
      }
    }
  },
  { contextual: false }
)

// helper function to look up charCodes
function _char(s) {
  return s.charCodeAt(0)
}

const CHAR_BACKSLASH = _char('\\')
const CHAR_OPEN_BRACE = _char('{')
const CHAR_OPEN_BRACKET = _char('[')
const CHAR_CLOSE_BRACE = _char('}')
const CHAR_TAB = _char('\t')
const CHAR_SPACE = _char(' ')
const CHAR_NEWLINE = _char('\n')

const lookaheadTokenizer = getToken =>
  new ExternalTokenizer(
    input => {
      for (let i = 0; i < MAX_ARGUMENT_LOOKAHEAD; ++i) {
        const next = input.peek(i)
        if (next === CHAR_SPACE || next === CHAR_TAB) {
          continue
        }
        const token = getToken(next)
        if (token) {
          input.acceptToken(token)
          return
        }
      }
    },
    { contextual: false, fallback: true }
  )

export const argumentListTokenizer = lookaheadTokenizer(next => {
  if (next === CHAR_OPEN_BRACE) {
    return hasMoreArguments
  } else {
    return endOfArguments
  }
})

export const argumentListWithOptionalTokenizer = lookaheadTokenizer(next => {
  if (next === CHAR_OPEN_BRACE || next === CHAR_OPEN_BRACKET) {
    return hasMoreArgumentsOrOptionals
  } else {
    return endOfArgumentsAndOptionals
  }
})

const CHAR_AT_SYMBOL = _char('@')

export const csnameTokenizer = new ExternalTokenizer((input, stack) => {
  let offset = 0
  let end = -1
  // look at the first character, we are looking for acceptable control sequence names
  // including @ signs, \\[a-zA-Z@]+
  const next = input.peek(offset)
  if (next === -1) {
    return
  }
  // reject anything not starting with a backslash,
  // we only accept control sequences
  if (next !== CHAR_BACKSLASH) {
    return
  }
  offset++
  for (;;) {
    const next = input.peek(offset)
    // stop when we reach the end of file or a non-csname character
    if (next === -1 || !(alphaChar(next) || next === CHAR_AT_SYMBOL)) {
      end = offset - 1
      break
    }
    end = offset
    offset++
  }
  if (end === -1) return
  // accept the content as a valid control sequence
  return input.acceptToken(Csname, end + 1)
})

const END_DOCUMENT_MARK = '\\end{document}'.split('').reverse()

export const trailingContentTokenizer = new ExternalTokenizer(
  (input, stack) => {
    if (input.next === -1) return // no trailing content
    // Look back for end-document mark, bail out if any characters do not match
    for (let i = 1; i < END_DOCUMENT_MARK.length + 1; i++) {
      if (String.fromCharCode(input.peek(-i)) !== END_DOCUMENT_MARK[i - 1]) {
        return
      }
    }
    while (input.next === CHAR_SPACE || input.next === CHAR_NEWLINE) {
      const next = input.advance()
      if (next === -1) return input.acceptToken(TrailingWhitespaceOnly) // trailing whitespace only
    }
    // accept the all content up to the end of the document
    while (input.advance() !== -1) {
      //
    }
    return input.acceptToken(TrailingContent)
  }
)

const refCommands = new Set([
  '\\fullref',
  '\\Vref',
  '\\autopageref',
  '\\autoref',
  '\\eqref',
  '\\labelcpageref',
  '\\labelcref',
  '\\lcnamecref',
  '\\lcnamecrefs',
  '\\namecref',
  '\\nameCref',
  '\\namecrefs',
  '\\nameCrefs',
  '\\thnameref',
  '\\thref',
  '\\titleref',
  '\\vrefrange',
  '\\Crefrange',
  '\\Crefrang',
  '\\fref',
  '\\pref',
  '\\tref',
  '\\Aref',
  '\\Bref',
  '\\Pref',
  '\\Sref',
  '\\vref',
  '\\nameref',
])

const refStarrableCommands = new Set([
  '\\vpageref',
  '\\vref',
  '\\zcpageref',
  '\\zcref',
  '\\zfullref',
  '\\zref',
  '\\zvpageref',
  '\\zvref',
  '\\cref',
  '\\Cref',
  '\\pageref',
  '\\ref',
  '\\Ref',
  '\\subref',
  '\\zpageref',
  '\\ztitleref',
  '\\vpagerefrange',
  '\\zvpagerefrange',
  '\\zvrefrange',
  '\\crefrange',
])

const citeCommands = new Set([
  '\\autocites',
  '\\Autocites',
  '\\Cite',
  '\\citeA',
  '\\citealp',
  '\\Citealp',
  '\\citealt',
  '\\Citealt',
  '\\citeauthorNP',
  '\\citeauthorp',
  '\\Citeauthorp',
  '\\citeauthort',
  '\\Citeauthort',
  '\\citeNP',
  '\\citenum',
  '\\citen',
  '\\citeonline',
  '\\cites',
  '\\Cites',
  '\\citeurl',
  '\\citeyearpar',
  '\\defcitealias',
  '\\fnotecite',
  '\\footcite',
  '\\footcitetext',
  '\\footfullcite',
  '\\footnotecites',
  '\\Footnotecites',
  '\\fullcite',
  '\\fullciteA',
  '\\fullciteauthor',
  '\\fullciteauthorNP',
  '\\maskcite',
  '\\maskciteA',
  '\\maskcitealp',
  '\\maskCitealp',
  '\\maskcitealt',
  '\\maskCitealt',
  '\\maskciteauthor',
  '\\maskciteauthorNP',
  '\\maskciteauthorp',
  '\\maskCiteauthorp',
  '\\maskciteauthort',
  '\\maskCiteauthort',
  '\\maskciteNP',
  '\\maskcitenum',
  '\\maskcitep',
  '\\maskCitep',
  '\\maskcitepalias',
  '\\maskcitet',
  '\\maskCitet',
  '\\maskcitetalias',
  '\\maskciteyear',
  '\\maskciteyearNP',
  '\\maskciteyearpar',
  '\\maskfullcite',
  '\\maskfullciteA',
  '\\maskfullciteauthor',
  '\\maskfullciteauthorNP',
  '\\masknocite',
  '\\maskshortcite',
  '\\maskshortciteA',
  '\\maskshortciteauthor',
  '\\maskshortciteauthorNP',
  '\\maskshortciteNP',
  '\\mautocite',
  '\\Mautocite',
  '\\mcite',
  '\\Mcite',
  '\\mfootcite',
  '\\mfootcitetext',
  '\\mparencite',
  '\\Mparencite',
  '\\msupercite',
  '\\mtextcite',
  '\\Mtextcite',
  '\\nocite',
  '\\nocitemeta',
  '\\notecite',
  '\\Parencite',
  '\\parencites',
  '\\Parencites',
  '\\pnotecite',
  '\\shortcite',
  '\\shortciteA',
  '\\shortciteauthor',
  '\\shortciteauthorNP',
  '\\shortciteNP',
  '\\smartcite',
  '\\Smartcite',
  '\\smartcites',
  '\\Smartcites',
  '\\supercite',
  '\\supercites',
  '\\textcite',
  '\\Textcite',
  '\\textcites',
  '\\Textcites',
])

const citeStarredCommands = new Set([
  '\\cite',
  '\\citeauthor',
  '\\Citeauthor',
  '\\citedate',
  '\\citep',
  '\\citepalias',
  '\\Citep',
  '\\citetitle',
  '\\citeyear',
  '\\parencite',
  '\\citet',
  '\\citetalias',
  '\\autocite',
  '\\Autocite',
])

const labelCommands = new Set(['\\label', '\\thlabel', '\\zlabel'])

const mathTextCommands = new Set(['\\text', '\\tag', '\\textrm', '\\intertext'])

const otherKnowncommands = {
  '\\hbox': HboxCtrlSeq,
  '\\title': TitleCtrlSeq,
  '\\author': AuthorCtrlSeq,
  '\\affil': AffilCtrlSeq,
  '\\affiliation': AffiliationCtrlSeq,
  '\\date': DateCtrlSeq,
  '\\documentclass': DocumentClassCtrlSeq,
  '\\usepackage': UsePackageCtrlSeq,
  '\\href': HrefCtrlSeq,
  '\\url': UrlCtrlSeq,
  '\\verb': VerbCtrlSeq,
  '\\lstinline': LstInlineCtrlSeq,
  '\\includegraphics': IncludeGraphicsCtrlSeq,
  '\\caption': CaptionCtrlSeq,
  '\\def': DefCtrlSeq,
  '\\let': LetCtrlSeq,
  '\\left': LeftCtrlSeq,
  '\\right': RightCtrlSeq,
  '\\newcommand': NewCommandCtrlSeq,
  '\\renewcommand': RenewCommandCtrlSeq,
  '\\newenvironment': NewEnvironmentCtrlSeq,
  '\\renewenvironment': RenewEnvironmentCtrlSeq,
  '\\book': BookCtrlSeq,
  '\\part': PartCtrlSeq,
  '\\addpart': PartCtrlSeq,
  '\\chapter': ChapterCtrlSeq,
  '\\addchap': ChapterCtrlSeq,
  '\\section': SectionCtrlSeq,
  '\\addseq': SectionCtrlSeq,
  '\\subsection': SubSectionCtrlSeq,
  '\\subsubsection': SubSubSectionCtrlSeq,
  '\\paragraph': ParagraphCtrlSeq,
  '\\subparagraph': SubParagraphCtrlSeq,
  '\\input': InputCtrlSeq,
  '\\include': IncludeCtrlSeq,
  '\\item': ItemCtrlSeq,
  '\\centering': CenteringCtrlSeq,
  '\\newtheorem': NewTheoremCtrlSeq,
  '\\theoremstyle': TheoremStyleCtrlSeq,
  '\\bibliography': BibliographyCtrlSeq,
  '\\bibliographystyle': BibliographyStyleCtrlSeq,
  '\\maketitle': MaketitleCtrlSeq,
  '\\textcolor': TextColorCtrlSeq,
  '\\colorbox': ColorBoxCtrlSeq,
  '\\hline': HLineCtrlSeq,
  '\\toprule': TopRuleCtrlSeq,
  '\\midrule': MidRuleCtrlSeq,
  '\\bottomrule': BottomRuleCtrlSeq,
  '\\multicolumn': MultiColumnCtrlSeq,
  '\\parbox': ParBoxCtrlSeq,
  '\\textbf': TextBoldCtrlSeq,
  '\\textit': TextItalicCtrlSeq,
  '\\textsc': TextSmallCapsCtrlSeq,
  '\\texttt': TextTeletypeCtrlSeq,
  '\\textmd': TextMediumCtrlSeq,
  '\\textsf': TextSansSerifCtrlSeq,
  '\\textsuperscript': TextSuperscriptCtrlSeq,
  '\\textsubscript': TextSubscriptCtrlSeq,
  '\\sout': TextStrikeOutCtrlSeq,
  '\\emph': EmphasisCtrlSeq,
  '\\underline': UnderlineCtrlSeq,
  '\\setlength': SetLengthCtrlSeq,
}
// specializer for control sequences
// return new tokens for specific control sequences
export const specializeCtrlSeq = (name, terms) => {
  if (name === '\\begin') return Begin
  if (name === '\\end') return End
  if (refCommands.has(name)) {
    return RefCtrlSeq
  }
  if (refStarrableCommands.has(name)) {
    return RefStarrableCtrlSeq
  }
  if (citeCommands.has(name)) {
    return CiteCtrlSeq
  }
  if (citeStarredCommands.has(name)) {
    return CiteStarrableCtrlSeq
  }
  if (labelCommands.has(name)) {
    return LabelCtrlSeq
  }
  if (mathTextCommands.has(name)) {
    return MathTextCtrlSeq
  }
  return otherKnowncommands[name] || -1
}

const tabularEnvNames = new Set([
  'tabular',
  'xltabular',
  'tabularx',
  'longtable',
])

const equationEnvNames = new Set([
  'equation',
  'equation*',
  'displaymath',
  'displaymath*',
  'math',
  'math*',
  'multline',
  'multline*',
  'matrix',
  'tikzcd',
])

const equationArrayEnvNames = new Set([
  'array',
  'eqnarray',
  'eqnarray*',
  'align',
  'align*',
  'alignat',
  'alignat*',
  'flalign',
  'flalign*',
  'gather',
  'gather*',
  'pmatrix',
  'pmatrix*',
  'bmatrix',
  'bmatrix*',
  'Bmatrix',
  'Bmatrix*',
  'vmatrix',
  'vmatrix*',
  'Vmatrix',
  'Vmatrix*',
  'smallmatrix',
  'smallmatrix*',
  'split',
  'split*',
  'gathered',
  'gathered*',
  'aligned',
  'aligned*',
  'alignedat',
  'alignedat*',
  'cases',
  'cases*',
  'dcases',
  'dcases*',
  'rcases',
  'rcases*',
  'IEEEeqnarray',
  'IEEEeqnarray*',
])

const verbatimEnvNames = new Set([
  'verbatim',
  'boxedverbatim',
  'lstlisting',
  'minted',
  'Verbatim',
  'lstlisting',
  'tcblisting',
  'codeexample',
  'comment',
])

const otherKnownEnvNames = {
  document: DocumentEnvName,
  tikzpicture: TikzPictureEnvName,
  figure: FigureEnvName,
  'figure*': FigureEnvName,
  subfigure: FigureEnvName,
  enumerate: ListEnvName,
  itemize: ListEnvName,
  table: TableEnvName,
  description: ListEnvName,
}

export const specializeEnvName = (name, terms) => {
  if (tabularEnvNames.has(name)) {
    return TabularEnvName
  }
  if (equationEnvNames.has(name)) {
    return EquationEnvName
  }
  if (equationArrayEnvNames.has(name)) {
    return EquationArrayEnvName
  }
  if (verbatimEnvNames.has(name)) {
    return VerbatimEnvName
  }
  return otherKnownEnvNames[name] || -1
}

const otherKnownCtrlSyms = {
  '\\(': OpenParenCtrlSym,
  '\\)': CloseParenCtrlSym,
  '\\[': OpenBracketCtrlSym,
  '\\]': CloseBracketCtrlSym,
  '\\\\': LineBreakCtrlSym,
}

export const specializeCtrlSym = (name, terms) => {
  return otherKnownCtrlSyms[name] || -1
}
