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
  MathDelimiter,
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
  DocumentClassCtrlSeq,
  UsePackageCtrlSeq,
  HrefCtrlSeq,
  VerbCtrlSeq,
  LstInlineCtrlSeq,
  IncludeGraphicsCtrlSeq,
  CaptionCtrlSeq,
  DefCtrlSeq,
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
  BibliographyCtrlSeq,
  BibliographyStyleCtrlSeq,
  CenteringCtrlSeq,
  ListEnvName,
  MaketitleCtrlSeq,
} from './latex.terms.mjs'

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
    let content = ''
    for (;;) {
      let next = input.next
      if (next === -1 || next === CHAR_NEWLINE) return
      content += String.fromCharCode(next)
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
    let offset = 0
    let end = -1
    for (;;) {
      const next = input.peek(offset)
      if (next === -1) {
        end = offset - 1
        break
      }
      if (matchForward(input, delimiter, offset)) {
        // Found the end marker
        end = offset - 1
        break
      }
      offset++
    }
    return input.acceptToken(VerbatimContent, end + 1)
  },
  { contextual: false }
)

// tokenizer for \href{...} and similar commands
export const literalArgTokenizer = new ExternalTokenizer(
  (input, stack) => {
    const delimiter = '}'
    let content = ''
    let offset = 0
    let end = -1
    for (;;) {
      const next = input.peek(offset)
      if (next === -1) {
        end = offset - 1
        break
      }
      content += String.fromCharCode(next)
      if (content.slice(-delimiter.length) === delimiter) {
        // found the '}'
        end = offset - delimiter.length
        break
      }
      offset++
    }
    return input.acceptToken(LiteralArgContent, end + 1)
  },
  { contextual: false }
)

// tokenizer for literal content delimited by whitespace, such as in `\input foo.tex`
export const spaceDelimitedLiteralArgTokenizer = new ExternalTokenizer(
  (input, stack) => {
    let content = ''
    let offset = 0
    let end = -1
    for (;;) {
      const next = input.peek(offset)
      if (next === -1) {
        end = offset - 1
        break
      }
      content += String.fromCharCode(next)
      if (content.slice(-1) === ' ' || content.slice(-1) === '\n') {
        // found the whitespace
        end = offset - 1
        break
      }
      offset++
    }
    return input.acceptToken(SpaceDelimitedLiteralArgContent, end + 1)
  },
  { contextual: false }
)

// helper function to look up charCodes
function _char(s) {
  return s.charCodeAt(0)
}

// Allowed delimiters, from the LaTeX manual, table 3.10
// (  ) [ ] / |  \{ \}  \| and additional names below
// The empty delimiter . is also allowed

const CHAR_SLASH = _char('/')
const CHAR_PIPE = _char('|')
const CHAR_OPEN_PAREN = _char('(')
const CHAR_CLOSE_PAREN = _char(')')
const CHAR_OPEN_BRACKET = _char('[')
const CHAR_CLOSE_BRACKET = _char(']')
const CHAR_FULL_STOP = _char('.')
const CHAR_BACKSLASH = _char('\\')
const CHAR_OPEN_BRACE = _char('{')
const CHAR_CLOSE_BRACE = _char('}')

const ALLOWED_DELIMITER_NAMES = [
  'lfloor',
  'rfloor',
  'lceil',
  'rceil',
  'langle',
  'rangle',
  'backslash',
  'uparrow',
  'downarrow',
  'Uparrow',
  'Downarrow',
  'updownarrow',
  'Updownarrow',
  'lvert',
  'rvert',
  'lVert',
  'rVert',
]

// Given a list of allowed command names, return those with leading characters that are the same as the matchString
function findPartialMatches(list, matchString) {
  const size = matchString.length
  return list.filter(
    entry => entry.length >= size && entry.substring(0, size) === matchString
  )
}

// tokenizer for \leftX ... \rightX delimiter tokens
export const mathDelimiterTokenizer = new ExternalTokenizer(
  (input, stack) => {
    let content = ''
    let offset = 0
    let end = -1
    // look at the first character, we only accept the following /|()[].
    let next = input.peek(offset)
    if (next === -1) {
      return
    }
    if (
      next === CHAR_SLASH ||
      next === CHAR_PIPE ||
      next === CHAR_OPEN_PAREN ||
      next === CHAR_CLOSE_PAREN ||
      next === CHAR_OPEN_BRACKET ||
      next === CHAR_CLOSE_BRACKET ||
      next === CHAR_FULL_STOP
    ) {
      return input.acceptToken(MathDelimiter, 1)
    }
    // reject anything else not starting with a backslash,
    // we only accept control symbols or control sequences
    if (next !== CHAR_BACKSLASH) {
      return
    }
    // look at the second character, we only accept \{ and \} and \| as control symbols
    offset++
    next = input.peek(offset)
    if (next === -1) {
      return
    }
    if (
      next === CHAR_OPEN_BRACE ||
      next === CHAR_CLOSE_BRACE ||
      next === CHAR_PIPE
    ) {
      return input.acceptToken(MathDelimiter, 2)
    }
    // We haven't matched any symbols, so now try matching command names.
    // Is this character a potential match to the remaining allowed delimiter names?
    content = String.fromCharCode(next)
    let candidates = findPartialMatches(ALLOWED_DELIMITER_NAMES, content)
    if (!candidates.length) return
    // we have some candidates, look at subsequent characters
    offset++
    for (;;) {
      const next = input.peek(offset)
      // stop when we reach the end of file or a non-alphabetic character
      if (next === -1 || !nameChar(next)) {
        end = offset - 1
        break
      }
      content += String.fromCharCode(next)
      // find how many candidates remain with the new input
      candidates = findPartialMatches(candidates, content)
      if (!candidates.length) return // no matches remaining
      end = offset
      offset++
    }
    if (!candidates.includes(content)) return // not a valid delimiter
    // accept the content as a valid delimiter
    return input.acceptToken(MathDelimiter, end + 1)
  },
  { contextual: false }
)

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

const CHAR_SPACE = _char(' ')
const CHAR_NEWLINE = _char('\n')
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
  '\\Citep',
  '\\citetitle',
  '\\citeyear',
  '\\parencite',
  '\\citet',
  '\\autocite',
  '\\Autocite',
])

const labelCommands = new Set(['\\label', '\\thlabel', '\\zlabel'])

const mathTextCommands = new Set(['\\text', '\\tag', '\\textrm', '\\intertext'])

const otherKnowncommands = {
  '\\hbox': HboxCtrlSeq,
  '\\title': TitleCtrlSeq,
  '\\author': AuthorCtrlSeq,
  '\\documentclass': DocumentClassCtrlSeq,
  '\\usepackage': UsePackageCtrlSeq,
  '\\href': HrefCtrlSeq,
  '\\verb': VerbCtrlSeq,
  '\\lstinline': LstInlineCtrlSeq,
  '\\includegraphics': IncludeGraphicsCtrlSeq,
  '\\caption': CaptionCtrlSeq,
  '\\def': DefCtrlSeq,
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
  '\\bibliography': BibliographyCtrlSeq,
  '\\bibliographystyle': BibliographyStyleCtrlSeq,
  '\\maketitle': MaketitleCtrlSeq,
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
  'codeexample',
  'comment',
])

const otherKnownEnvNames = {
  document: DocumentEnvName,
  tikzpicture: TikzPictureEnvName,
  figure: FigureEnvName,
  subfigure: FigureEnvName,
  enumerate: ListEnvName,
  itemize: ListEnvName,
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
}

export const specializeCtrlSym = (name, terms) => {
  return otherKnownCtrlSyms[name] || -1
}
