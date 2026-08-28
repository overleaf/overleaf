import { BibtexFieldValue } from './bibtex-field-value.mts'
import { getEntryType } from './entry-types.mts'
import { BibtexNameList } from './bibtex-name.mts'

type Fields = ReadonlyMap<string, BibtexFieldValue>

type BibtexEntryOptions = {
  type?: string
  key?: string
  fields?: Fields
  id?: string
  occurrenceIndex?: number
  updatedAt?: Date
}

/**
 * Immutable BibTeX entry content. Position information lives separately on
 * `PositionedBibtexEntry` so `BibtexEntry` references can stay stable across
 * pure position shifts (e.g. when typing above an entry).
 */
export class BibtexEntry {
  /**
   * Entry type
   */
  readonly type: string

  /**
   * Citation key
   */
  readonly key: string

  /**
   * Fields
   */
  readonly fields: Fields

  /**
   * Last updated timestamp (set when loaded from the library)
   */
  readonly updatedAt: Date | undefined

  private readonly _id: string

  /**
   * Position of this entry among entries that share its citation key, in
   * document order (0-based). In-project entries can share a citation key, so
   * this disambiguates them. It is positional metadata (not content), assigned
   * by `useBibtexEntries` once the full, ordered entry list is known.
   */
  occurrenceIndex: number

  /**
   * Stable identifier.
   * - Library entries: the database record ID.
   * - In-project entries: `${key}#${occurrenceIndex}`, so duplicate keys still
   *   get distinct ids and can be located unambiguously in the document.
   */
  get id(): string {
    if (this._id) return this._id
    return `${this.key}#${this.occurrenceIndex}`
  }

  constructor({
    type = 'article',
    key = '',
    fields = new Map(),
    id = '',
    occurrenceIndex = 0,
    updatedAt,
  }: BibtexEntryOptions = {}) {
    this.type = type
    this.key = key
    this.fields = fields
    this._id = id
    this.occurrenceIndex = occurrenceIndex
    this.updatedAt = updatedAt
  }

  setType(type: string) {
    return new BibtexEntry({ ...this, type, id: this._id })
  }

  setKey(key: string) {
    return new BibtexEntry({ ...this, key, id: this._id })
  }

  getField(field: string) {
    return this.fields.get(field) ?? new BibtexFieldValue()
  }

  getFields() {
    return this.fields.keys()
  }

  getFieldsArray() {
    return Array.from(this.fields.entries()).map(([key, value]) => ({
      key,
      value,
    }))
  }

  /** Returns all authors (and editors, as fallback) as a parsed BibtexNameList. */
  getAuthors(): BibtexNameList {
    const authorStr =
      this.getField('author').toDisplayString() ||
      this.getField('editor').toDisplayString()
    return new BibtexNameList(authorStr)
  }

  getTitle(): string {
    return (
      this.getField('title').toDisplayString() ||
      this.getField('subtitle').toDisplayString()
    )
  }

  getYear(): string {
    const year = this.getField('year').toDisplayString()
    if (year) return year
    const dateStr = this.getField('date').toDisplayString()
    const match = dateStr.match(/^\d{4}/)
    return match ? match[0] : ''
  }

  hasField(field: string) {
    return this.fields.has(field)
  }

  hasFields() {
    return this.fields.size > 0
  }

  setField(field: string, value: BibtexFieldValue) {
    const fields = new Map(this.fields)
    fields.set(field, value)
    return new BibtexEntry({ ...this, fields, id: this._id })
  }

  deleteField(field: string) {
    const fields = new Map(this.fields)
    fields.delete(field)
    return new BibtexEntry({ ...this, fields, id: this._id })
  }

  toString(): string {
    let bibEntry = `@${this.type}{${this.key},\n`
    for (const [field, value] of this.fields) {
      bibEntry += `  ${field} = ${value.toString()},\n`
    }
    bibEntry += '}'
    return bibEntry
  }

  getWarnings(): BibtexEntryWarning[] {
    const warnings: BibtexEntryWarning[] = []

    const missingFieldGroups = this.getMissingFieldGroups()
    if (missingFieldGroups.length > 0) {
      warnings.push(new MissingFieldsWarning(missingFieldGroups))
    }
    return warnings
  }

  getMissingFieldGroups(): string[][] {
    const entryType = getEntryType(this.type)
    const requiredFields = entryType.requiredFields
    const missingFields: string[][] = []
    for (const requiredField of requiredFields) {
      const group = Array.isArray(requiredField)
        ? requiredField
        : [requiredField]
      if (!group.some(field => this.hasField(field))) {
        missingFields.push(group)
      }
    }
    return missingFields
  }
}

export class MissingFieldsWarning {
  fieldGroups: string[][]

  constructor(fieldGroups: string[][]) {
    this.fieldGroups = fieldGroups
  }
}

export type BibtexEntryWarning = MissingFieldsWarning
