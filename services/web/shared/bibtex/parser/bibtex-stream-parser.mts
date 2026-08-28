import OError from '@overleaf/o-error'
import { BibtexEntry } from '../bibtex-entry.mts'
import {
  BibtexFieldValue,
  BibtexFieldValueBuilder,
} from '../bibtex-field-value.mts'
import {
  AT,
  CARRIAGE_RETURN,
  CLOSE_BRACE,
  CLOSE_PAREN,
  COMMA,
  EQUALS,
  HASH,
  LINE_FEED,
  OPEN_BRACE,
  OPEN_PAREN,
  PERCENT,
  QUOTE,
  isBibtexIdentifierCharCode,
  isBibtexIdentifierStartCharCode,
  isDigitCode,
  isWhitespaceCode,
} from './bibtex-char-codes.mts'

export type BibtexEntryItem = {
  kind: 'entry'
  entry: BibtexEntry
}

/** A `@string` definition, which the parser records rather than expands. */
export type BibtexNamedStringItem = {
  kind: 'namedString'
  /**
   * Kept as written, as are the references to it. Names are matched
   * case-insensitively, so a consumer resolving references has to fold case
   * when it builds its lookup table — but lowercasing here would rewrite the
   * author's own spelling of the name whenever an entry is read and written
   * back, which entry types and field names do not have to worry about.
   *
   * A definition also takes effect only from where it appears, replacing any
   * earlier one from that point on, so resolution has to follow item order.
   */
  name: string
  value: BibtexFieldValue
}

/** A `%` comment or a `@comment` body, without its delimiters. */
export type BibtexCommentItem = {
  kind: 'comment'
  text: string
}

/** Free-form text between entries, which BibTeX ignores. */
export type BibtexJunkItem = {
  kind: 'junk'
  text: string
}

export type BibtexItem =
  | BibtexEntryItem
  | BibtexNamedStringItem
  | BibtexCommentItem
  | BibtexJunkItem

/*
 * Parser states. Those up to and including AFTER_VALUE sit between entry
 * tokens, where whitespace and %-comments are skipped; the main loop tests for
 * them with a single comparison, so their order matters. The IN_* states are
 * mid-token, and are the only ones a chunk boundary can fall inside.
 */
const TOP = 0
const EXPECT_TYPE = 1
const EXPECT_BODY_OPEN = 2
const EXPECT_KEY = 3
const AFTER_KEY = 4
const EXPECT_FIELD_NAME = 5
const EXPECT_EQUALS = 6
const EXPECT_VALUE = 7
const AFTER_VALUE = 8
const LAST_INTER_TOKEN_STATE = AFTER_VALUE
const IN_TYPE = 9
const IN_KEY = 10
const IN_FIELD_NAME = 11
const IN_NUMBER = 12
const IN_NAME = 13
const IN_LITERAL = 14
const IN_COMMENT_BODY = 15
const IN_JUNK_WORD = 16
const IN_JUNK_SPACE = 17
const IN_LINE_COMMENT = 18

/** What an entry's body holds, selected by its type. */
const REGULAR = 0 // fields, introduced by a citation key
const NAMED_STRING = 1 // @string: named string definitions
const PREAMBLE = 2 // @preamble: a single value
const COMMENT = 3 // @comment: a literal

/** Mirrors specializeEntryType in the editor's bibtex grammar. */
function bodyKindOf(lowercasedType: string): number {
  switch (lowercasedType) {
    case 'string':
      return NAMED_STRING
    case 'preamble':
      return PREAMBLE
    case 'comment':
      return COMMENT
    default:
      return REGULAR
  }
}

/**
 * Cap on the input one item may span. Streaming only keeps memory down while
 * items keep completing: an unterminated literal, a single enormous word of
 * junk, or an entry with endless fields would otherwise buffer the whole rest of
 * the input. The limit is far above any real entry, comment or run of junk, so
 * reaching it means the input is not a .bib file.
 */
const MAX_ITEM_LENGTH = 1 << 20

/**
 * Thrown when one item spans more than MAX_ITEM_LENGTH characters of input. It
 * leaves the parser part-way through that item, so the parser has to be
 * discarded rather than written to again.
 */
export class BibtexItemTooLargeError extends OError {}

/**
 * Chunk-oblivious BibTeX parser, built to index .bib files too large to hold a
 * syntax tree for. It follows the same grammar as the editor's lezer parser
 * (frontend/js/features/source-editor/lezer-bibtex/bibtex.grammar) and reads
 * every entry the same way, so a reader sees the same references the editor
 * shows them. The differential test in the library module pins that.
 *
 * Items come out in the order they occur, with one exception: a comment written
 * inside an entry is reported before the entry that contains it, because the
 * entry is only complete at its closing delimiter.
 *
 * Entries sharing a citation key are all reported, leaving it to the caller to
 * decide which one wins. `@preamble` bodies are the only content dropped.
 *
 * An item spanning more than MAX_ITEM_LENGTH characters of input throws
 * BibtexItemTooLargeError, so that no input can buffer without bound.
 */
export class BibtexStreamParser {
  private state = TOP
  private commentReturnState = TOP

  /**
   * Token text so far, which a chunk boundary may have cut in half. Only one
   * token is ever in flight: every state that can start a comment or a run of
   * junk is reached with the buffer already emptied.
   */
  private token = ''

  /** Whitespace inside a run of junk, held back until a word follows it. */
  private pendingSpace = ''

  /**
   * Input consumed towards the item being read, against MAX_ITEM_LENGTH.
   * Everything the parser holds on to between chunks — the token in flight, the
   * entry's type, key and fields, the parts of the value being built — was read
   * from this stretch of input, so bounding it bounds all of them.
   */
  private consumed = 0

  private bodyKind = REGULAR

  /** Closing delimiter the entry body's opener calls for. */
  private bodyTerminator = CLOSE_BRACE

  private entryType: string | null = null
  private entryKey: string | null = null
  private fields = new Map<string, BibtexFieldValue>()
  private fieldName: string | null = null

  /**
   * The parts of the value being read. An empty builder separates "foo" and
   * "foo =", which define nothing — biber rejects both as syntax errors — from
   * "foo = {}", which defines the empty string and so adds a part.
   */
  private fieldValue = new BibtexFieldValueBuilder()

  /** Closing delimiter of the literal being scanned, and its brace nesting. */
  private literalTerminator = CLOSE_BRACE
  private literalDepth = 0

  private items: BibtexItem[] = []

  /** Parses a chunk, returning the items it completed. */
  write(chunk: string): BibtexItem[] {
    let i = 0
    while (i < chunk.length) {
      const state = this.state

      if (state <= LAST_INTER_TOKEN_STATE) {
        const code = chunk.charCodeAt(i)
        if (isWhitespaceCode(code)) {
          // Whitespace between tokens is dropped, so it costs no memory and
          // goes uncounted: a file can hold as much of it as it likes.
          i += 1
          continue
        }
        if (code === PERCENT) {
          this.commentReturnState = state
          this.state = IN_LINE_COMMENT
          i += 1
          continue
        }
      }

      const start = i

      switch (state) {
        case TOP:
          i = this.parseTop(chunk, i)
          break
        case EXPECT_TYPE:
          i = this.parseExpectType(chunk, i)
          break
        case EXPECT_BODY_OPEN:
          i = this.parseExpectBodyOpen(chunk, i)
          break
        case EXPECT_KEY:
          i = this.parseExpectKey(chunk, i)
          break
        case AFTER_KEY:
          i = this.parseAfterKey(chunk, i)
          break
        case EXPECT_FIELD_NAME:
          i = this.parseExpectFieldName(chunk, i)
          break
        case EXPECT_EQUALS:
          i = this.parseExpectEquals(chunk, i)
          break
        case EXPECT_VALUE:
          i = this.parseExpectValue(chunk, i)
          break
        case AFTER_VALUE:
          i = this.parseAfterValue(chunk, i)
          break
        case IN_TYPE:
          i = this.scanType(chunk, i)
          break
        case IN_KEY:
          i = this.scanKey(chunk, i)
          break
        case IN_FIELD_NAME:
          i = this.scanFieldName(chunk, i)
          break
        case IN_NUMBER:
          i = this.scanNumber(chunk, i)
          break
        case IN_NAME:
          i = this.scanName(chunk, i)
          break
        case IN_LITERAL:
          i = this.scanValueLiteral(chunk, i)
          break
        case IN_COMMENT_BODY:
          i = this.scanCommentBody(chunk, i)
          break
        case IN_JUNK_WORD:
          i = this.scanJunkWord(chunk, i)
          break
        case IN_JUNK_SPACE:
          i = this.scanJunkSpace(chunk, i)
          break
        case IN_LINE_COMMENT:
          i = this.scanLineComment(chunk, i)
          break
      }

      this.consume(i - start)
    }
    return this.takeItems()
  }

  /**
   * Signals the end of the input, returning any final items. An entry left
   * unterminated still yields what was parsed of it, as it does in the editor.
   */
  end(): BibtexItem[] {
    switch (this.state) {
      case IN_TYPE:
        this.finishType()
        break
      case IN_KEY:
        this.finishKey()
        break
      case IN_FIELD_NAME:
        this.finishFieldName()
        break
      case IN_NUMBER:
        this.finishNumber()
        break
      case IN_NAME:
        this.finishName()
        break
      case IN_LITERAL:
        this.finishLiteral()
        break
      case IN_COMMENT_BODY:
        this.emitComment()
        break
      case IN_JUNK_WORD:
      case IN_JUNK_SPACE:
        this.emitJunk()
        break
      case IN_LINE_COMMENT:
        this.emitComment()
        break
    }
    this.endEntry()
    this.state = TOP
    this.consumed = 0
    return this.takeItems()
  }

  private parseTop(chunk: string, i: number): number {
    if (chunk.charCodeAt(i) === AT) {
      this.beginEntry()
      this.state = EXPECT_TYPE
      return i + 1
    }
    this.state = IN_JUNK_WORD
    return i
  }

  /**
   * Scans a word of free-form comment text. Where the word ends decides how the
   * next "%" reads: it only opens a comment at the start of a word, so
   * "Junk% @article{a}" holds an entry while "Junk % @article{a}" has it
   * commented out.
   */
  private scanJunkWord(chunk: string, i: number): number {
    const start = i
    while (i < chunk.length) {
      const code = chunk.charCodeAt(i)
      if (code === AT) {
        this.token += chunk.slice(start, i)
        this.emitJunk()
        this.state = TOP
        return i
      }
      if (isWhitespaceCode(code)) {
        this.token += chunk.slice(start, i)
        this.state = IN_JUNK_SPACE
        return i
      }
      i += 1
    }
    this.token += chunk.slice(start, i)
    return i
  }

  private scanJunkSpace(chunk: string, i: number): number {
    const start = i
    while (i < chunk.length && isWhitespaceCode(chunk.charCodeAt(i))) {
      i += 1
    }
    this.pendingSpace += chunk.slice(start, i)
    if (i === chunk.length) {
      return i
    }

    const code = chunk.charCodeAt(i)
    if (code === AT || code === PERCENT) {
      this.emitJunk()
      this.state = TOP
      return i
    }
    this.token += this.pendingSpace
    this.pendingSpace = ''
    this.state = IN_JUNK_WORD
    return i
  }

  private scanLineComment(chunk: string, i: number): number {
    const start = i
    while (i < chunk.length) {
      const code = chunk.charCodeAt(i)
      if (code === LINE_FEED || code === CARRIAGE_RETURN) {
        break
      }
      i += 1
    }
    this.token += chunk.slice(start, i)
    if (i < chunk.length) {
      this.emitComment()
      this.state = this.commentReturnState
    }
    return i
  }

  private parseExpectType(chunk: string, i: number): number {
    if (isBibtexIdentifierStartCharCode(chunk.charCodeAt(i))) {
      this.state = IN_TYPE
      return i
    }
    return this.recover(i)
  }

  private scanType(chunk: string, i: number): number {
    i = this.scanIdentifier(chunk, i)
    if (i < chunk.length) {
      this.finishType()
    }
    return i
  }

  private finishType() {
    const type = this.takeToken().toLowerCase()
    this.entryType = type
    this.bodyKind = bodyKindOf(type)
    this.state = EXPECT_BODY_OPEN
  }

  private parseExpectBodyOpen(chunk: string, i: number): number {
    const code = chunk.charCodeAt(i)
    if (code !== OPEN_BRACE && code !== OPEN_PAREN) {
      return this.recover(i)
    }
    this.bodyTerminator = code === OPEN_BRACE ? CLOSE_BRACE : CLOSE_PAREN
    switch (this.bodyKind) {
      case COMMENT:
        // A @comment body is a literal rather than a list of values, so it
        // swallows any entry written inside it.
        this.beginLiteral(this.bodyTerminator)
        this.state = IN_COMMENT_BODY
        break
      case PREAMBLE:
        this.state = EXPECT_VALUE
        break
      case NAMED_STRING:
        this.state = EXPECT_FIELD_NAME
        break
      default:
        this.state = EXPECT_KEY
    }
    return i + 1
  }

  private parseExpectKey(chunk: string, i: number): number {
    if (isBibtexIdentifierCharCode(chunk.charCodeAt(i))) {
      this.state = IN_KEY
      return i
    }
    return this.recover(i)
  }

  private scanKey(chunk: string, i: number): number {
    i = this.scanIdentifier(chunk, i)
    if (i < chunk.length) {
      this.finishKey()
    }
    return i
  }

  private finishKey() {
    // Citation keys keep their case, unlike types and field names.
    this.entryKey = this.takeToken()
    this.state = AFTER_KEY
  }

  private parseAfterKey(chunk: string, i: number): number {
    const code = chunk.charCodeAt(i)
    if (code === COMMA) {
      this.state = EXPECT_FIELD_NAME
      return i + 1
    }
    if (code === this.bodyTerminator) {
      return this.closeBody(i)
    }
    return this.recover(i)
  }

  private parseExpectFieldName(chunk: string, i: number): number {
    const code = chunk.charCodeAt(i)
    if (code === this.bodyTerminator) {
      return this.closeBody(i)
    }
    if (isBibtexIdentifierStartCharCode(code)) {
      this.state = IN_FIELD_NAME
      return i
    }
    return this.recover(i)
  }

  private scanFieldName(chunk: string, i: number): number {
    i = this.scanIdentifier(chunk, i)
    if (i < chunk.length) {
      this.finishFieldName()
    }
    return i
  }

  private finishFieldName() {
    this.fieldName = this.takeToken()
    this.state = EXPECT_EQUALS
  }

  private parseExpectEquals(chunk: string, i: number): number {
    const code = chunk.charCodeAt(i)
    if (code === EQUALS) {
      this.state = EXPECT_VALUE
      return i + 1
    }
    if (code === this.bodyTerminator) {
      return this.closeBody(i)
    }
    return this.recover(i)
  }

  private parseExpectValue(chunk: string, i: number): number {
    const code = chunk.charCodeAt(i)
    if (code === OPEN_BRACE || code === QUOTE) {
      this.beginLiteral(code === OPEN_BRACE ? CLOSE_BRACE : QUOTE)
      this.state = IN_LITERAL
      return i + 1
    }
    if (isDigitCode(code)) {
      this.state = IN_NUMBER
      return i
    }
    if (isBibtexIdentifierStartCharCode(code)) {
      this.state = IN_NAME
      return i
    }
    // A missing value contributes no part, so "title=," and "title={x} #}"
    // behave as if the value had already ended here.
    this.state = AFTER_VALUE
    return i
  }

  private scanNumber(chunk: string, i: number): number {
    const start = i
    while (i < chunk.length && isDigitCode(chunk.charCodeAt(i))) {
      i += 1
    }
    this.token += chunk.slice(start, i)
    if (i < chunk.length) {
      this.finishNumber()
    }
    return i
  }

  private finishNumber() {
    this.fieldValue.addNumber(this.takeToken())
    this.state = AFTER_VALUE
  }

  private scanName(chunk: string, i: number): number {
    i = this.scanIdentifier(chunk, i)
    if (i < chunk.length) {
      this.finishName()
    }
    return i
  }

  private finishName() {
    // A reference to a named string is recorded, not expanded.
    this.fieldValue.addNamedString(this.takeToken())
    this.state = AFTER_VALUE
  }

  private scanValueLiteral(chunk: string, i: number): number {
    i = this.scanLiteral(chunk, i)
    if (i < chunk.length) {
      this.finishLiteral()
      return i + 1
    }
    return i
  }

  private finishLiteral() {
    // A line break and the indentation following it collapse to one space.
    this.fieldValue.addString(this.takeToken().replaceAll(/[\n\r]\s*/g, ' '))
    this.state = AFTER_VALUE
  }

  private scanCommentBody(chunk: string, i: number): number {
    i = this.scanLiteral(chunk, i)
    if (i < chunk.length) {
      this.emitComment()
      this.endEntry()
      this.state = TOP
      return i + 1
    }
    return i
  }

  private parseAfterValue(chunk: string, i: number): number {
    const code = chunk.charCodeAt(i)
    if (code === HASH) {
      this.state = EXPECT_VALUE
      return i + 1
    }
    if (code === COMMA) {
      this.commitField()
      this.state = EXPECT_FIELD_NAME
      return i + 1
    }
    if (code === this.bodyTerminator) {
      return this.closeBody(i)
    }
    return this.recover(i)
  }

  /** Appends identifier characters to the token buffer. */
  private scanIdentifier(chunk: string, i: number): number {
    const start = i
    while (
      i < chunk.length &&
      isBibtexIdentifierCharCode(chunk.charCodeAt(i))
    ) {
      i += 1
    }
    this.token += chunk.slice(start, i)
    return i
  }

  private beginLiteral(terminator: number) {
    this.literalTerminator = terminator
    this.literalDepth = 0
  }

  /**
   * Appends literal text to the token buffer, stopping at its closing
   * delimiter. Only braces nest, and there are no backslash escapes: every
   * other delimiter is content until the nesting is back to zero.
   */
  private scanLiteral(chunk: string, i: number): number {
    const start = i
    while (i < chunk.length) {
      const code = chunk.charCodeAt(i)
      if (code === OPEN_BRACE) {
        this.literalDepth += 1
      } else if (code === CLOSE_BRACE && this.literalDepth > 0) {
        this.literalDepth -= 1
      } else if (this.literalDepth === 0 && code === this.literalTerminator) {
        break
      }
      i += 1
    }
    this.token += chunk.slice(start, i)
    return i
  }

  /**
   * Counts the input a step of the main loop read towards the item in progress.
   * Landing back at TOP means the item is complete and the parser is holding
   * nothing, so the count starts over from there.
   */
  private consume(length: number) {
    if (this.state === TOP) {
      this.consumed = 0
      return
    }
    this.consumed += length
    if (this.consumed > MAX_ITEM_LENGTH) {
      throw new BibtexItemTooLargeError('bibtex item is too large', {
        limit: MAX_ITEM_LENGTH,
      })
    }
  }

  private takeToken(): string {
    const token = this.token
    this.token = ''
    return token
  }

  private emitJunk() {
    const text = this.takeToken()
    this.pendingSpace = ''
    if (text !== '') {
      this.items.push({ kind: 'junk', text })
    }
  }

  private emitComment() {
    const text = this.takeToken()
    // A comment can sit inside an entry, whose fields are still held, so only
    // the comment's own share of the input is given back.
    this.consumed -= text.length
    this.items.push({ kind: 'comment', text })
  }

  private beginEntry() {
    this.bodyKind = REGULAR
    this.entryType = null
    this.entryKey = null
    this.fields = new Map()
    this.fieldName = null
    this.fieldValue = new BibtexFieldValueBuilder()
    this.token = ''
  }

  private commitField() {
    if (this.fieldName != null) {
      if (this.bodyKind === NAMED_STRING) {
        // "@string{foo}" and "@string{foo =}" define nothing, so reporting them
        // would let either shadow an earlier valid definition of foo.
        if (!this.fieldValue.isEmpty()) {
          this.items.push({
            kind: 'namedString',
            name: this.fieldName,
            value: this.fieldValue.build(),
          })
        }
      } else {
        // A field with no value is still committed, to match the editor.
        this.fields.set(this.fieldName.toLowerCase(), this.fieldValue.build())
      }
    }
    this.fieldName = null
    this.fieldValue = new BibtexFieldValueBuilder()
  }

  private closeBody(i: number): number {
    this.endEntry()
    this.state = TOP
    return i + 1
  }

  /**
   * Ends the entry where it stands after an unexpected character, keeping the
   * fields parsed so far. Leaving the character for the top level to look at
   * again is what lets an unclosed entry hand the next "@" to a fresh one.
   */
  private recover(i: number): number {
    this.endEntry()
    this.state = TOP
    return i
  }

  /**
   * Completes the entry in progress, reporting it if it has both a type and a
   * citation key.
   */
  private endEntry() {
    this.commitField()
    if (
      this.bodyKind === REGULAR &&
      this.entryType != null &&
      this.entryKey != null
    ) {
      this.items.push({
        kind: 'entry',
        entry: new BibtexEntry({
          type: this.entryType,
          key: this.entryKey,
          fields: this.fields,
        }),
      })
    }
    this.entryType = null
    this.entryKey = null
    this.fields = new Map()
    this.token = ''
  }

  private takeItems(): BibtexItem[] {
    const items = this.items
    this.items = []
    return items
  }
}

/** Parses a whole .bib file held in memory. */
export function parseBibtexItems(text: string): BibtexItem[] {
  const parser = new BibtexStreamParser()
  const items = parser.write(text)
  return items.concat(parser.end())
}

/**
 * Parses a .bib file arriving in chunks. The caller is responsible for decoding
 * bytes with a stateful decoder, so a multi-byte character split across chunks
 * is not corrupted.
 */
export async function* streamBibtexItems(
  chunks: AsyncIterable<string>
): AsyncGenerator<BibtexItem> {
  const parser = new BibtexStreamParser()
  for await (const chunk of chunks) {
    yield* parser.write(chunk)
  }
  yield* parser.end()
}
