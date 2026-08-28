import { SyntaxNodeRef, Tree as LezerTree } from '@lezer/common'
import {
  Junk,
  Entry,
  EntryType,
  CitationKey,
  Field,
  FieldName,
  NumberLiteral,
  StringName,
} from '@/features/source-editor/lezer-bibtex/bibtex.terms.mjs'
import { parser as lezerParser } from '@/features/source-editor/lezer-bibtex/bibtex.mjs'
import { BibtexEntry } from '@shared/bibtex/bibtex-entry.mts'
import { PositionedBibtexEntry } from './positioned-bibtex-entry'
import {
  BibtexFieldValue,
  BibtexFieldValueBuilder,
} from '@shared/bibtex/bibtex-field-value.mts'

type GetText = (from: number, to: number) => string

export type ParseResult = {
  entries: BibtexEntry[]
  junk: string
}

export function parseBibtex(input: string): ParseResult {
  const tree = lezerParser.parse(input)
  const parser = new BibtexParser(tree, (from, to) => input.slice(from, to))
  parser.parse()
  return {
    entries: parser.entries.map(positioned => positioned.entry),
    junk: parser.junk,
  }
}

/**
 * Walks a single Entry's subtree, accumulating type / key / fields, and
 * yields a `BibtexEntry` via `build()`. The walker fires `enter` and `leave`
 * events that the caller must dispatch — this matches lezer's
 * `tree.iterate` enter/leave semantics so it can be plugged into both
 * whole-tree parsers and incremental projection visitors.
 */
export class BibtexEntryAccumulator {
  private type: string | null = null
  private key: string | null = null
  private fields: Map<string, BibtexFieldValue> = new Map()
  private fieldName: string | null = null
  private fieldValue = new BibtexFieldValueBuilder()

  reset() {
    this.type = null
    this.key = null
    this.fields = new Map()
    this.fieldName = null
    this.fieldValue = new BibtexFieldValueBuilder()
  }

  /**
   * Returns false when the node is fully handled and the caller should not
   * descend into its children, matching lezer's iterate API.
   */
  enter(node: SyntaxNodeRef, getText: GetText): boolean {
    const type = node.type
    if (type.is(EntryType)) {
      this.type = getText(node.from, node.to).toLowerCase()
      return false
    }
    if (type.is(CitationKey)) {
      this.key = getText(node.from, node.to)
      return false
    }
    if (type.is(FieldName)) {
      this.fieldName = getText(node.from, node.to).toLowerCase()
      return false
    }
    // StringContents spans a literal's text without its delimiters; lezer does
    // not export a term for it. Multi-line indentation is collapsed.
    if (type.name === 'StringContents') {
      const s = getText(node.from, node.to).replaceAll(/[\n\r]\s*/g, ' ')
      this.fieldValue.addString(s)
      return false
    }
    if (type.is(NumberLiteral)) {
      this.fieldValue.addNumber(getText(node.from, node.to))
      return false
    }
    if (type.is(StringName)) {
      this.fieldValue.addNamedString(getText(node.from, node.to))
      return false
    }
    return true
  }

  leave(node: SyntaxNodeRef) {
    if (node.type.is(Field)) {
      if (this.fieldName != null) {
        this.fields.set(this.fieldName, this.fieldValue.build())
      }
      this.fieldName = null
      this.fieldValue = new BibtexFieldValueBuilder()
    }
  }

  /**
   * Constructs a BibtexEntry from the accumulated state, or returns null if
   * the entry was missing a type or key.
   */
  build(): BibtexEntry | null {
    if (this.type == null || this.key == null) return null
    return new BibtexEntry({
      type: this.type,
      key: this.key,
      fields: this.fields,
    })
  }
}

class BibtexParser {
  tree: LezerTree
  getText: GetText
  lineAt: ((pos: number) => number) | undefined
  entries: PositionedBibtexEntry[] = []
  junk: string = ''
  seenKeys: Set<string> = new Set()
  duplicateKeys: Set<string> = new Set()
  private accumulator: BibtexEntryAccumulator = new BibtexEntryAccumulator()
  private inEntry: boolean = false
  private entryFrom: number = 0
  private entryTo: number = 0

  constructor(
    tree: LezerTree,
    getText: GetText,
    options: { lineAt?: (pos: number) => number } = {}
  ) {
    this.tree = tree
    this.getText = getText
    this.lineAt = options.lineAt
  }

  parse() {
    this.tree.iterate({
      enter: this.enterNode.bind(this),
      leave: this.leaveNode.bind(this),
    })
  }

  enterNode(node: SyntaxNodeRef) {
    const type = node.type

    if (type.is(Entry)) {
      this.accumulator.reset()
      this.inEntry = true
      this.entryFrom = node.from
      this.entryTo = node.to
      return true
    }

    if (type.is(Junk)) {
      this.junk += this.getText(node.from, node.to) + '\n'
      return false
    }

    if (!this.inEntry) {
      return true
    }
    return this.accumulator.enter(node, this.getText)
  }

  leaveNode(node: SyntaxNodeRef) {
    if (node.type.is(Entry)) {
      this.storeEntry()
      this.inEntry = false
    } else if (this.inEntry) {
      this.accumulator.leave(node)
    }
  }

  private storeEntry() {
    const entry = this.accumulator.build()
    if (!entry) return
    if (this.seenKeys.has(entry.key)) {
      this.duplicateKeys.add(entry.key)
      return
    }
    this.seenKeys.add(entry.key)
    this.entries.push(
      Object.assign(new PositionedBibtexEntry(), {
        entry,
        from: this.entryFrom,
        to: this.entryTo,
        line: this.lineAt ? this.lineAt(this.entryFrom) : 0,
        toLine: this.lineAt ? this.lineAt(this.entryTo) : 0,
      })
    )
  }
}
