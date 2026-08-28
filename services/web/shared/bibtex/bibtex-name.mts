type VonLast = { von: string; last: string }
type FirstVonLast = { first: string; von: string; last: string }

/**
 * Splits "von Last" (the left-hand segment in BibTeX comma notation) into its
 * von particle and Last components. The final word is always part of Last;
 * preceding lowercase-initial words are the von particle.
 */
function parseVonLast(vonLast: string): VonLast {
  const words = vonLast.split(/\s+/).filter(Boolean)
  if (words.length === 0) return { von: '', last: '' }
  if (words.length === 1) return { von: '', last: words[0] }
  const mandatory = words[words.length - 1]
  const preceding = words.slice(0, -1)
  let lastVonIdx = -1
  for (let i = preceding.length - 1; i >= 0; i--) {
    if (/^[a-z]/.test(preceding[i])) {
      lastVonIdx = i
      break
    }
  }
  if (lastVonIdx === -1) return { von: '', last: words.join(' ') }
  return {
    von: preceding.slice(0, lastVonIdx + 1).join(' '),
    last: [...preceding.slice(lastVonIdx + 1), mandatory].join(' '),
  }
}

/**
 * Parses a "First von Last" name (no commas) into its three components. The
 * final word is always part of Last; uppercase words following the last
 * lowercase (von) word extend Last; lowercase words form the von particle.
 */
function parseFirstVonLast(name: string): FirstVonLast {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return { first: '', von: '', last: '' }
  if (words.length === 1) return { first: '', von: '', last: words[0] }
  const mandatory = words[words.length - 1]
  const preceding = words.slice(0, -1)
  let firstVonIdx = -1
  let lastVonIdx = -1
  for (let i = 0; i < preceding.length; i++) {
    if (/^[a-z]/.test(preceding[i])) {
      if (firstVonIdx === -1) firstVonIdx = i
      lastVonIdx = i
    }
  }
  if (lastVonIdx === -1) {
    return { first: preceding.join(' '), von: '', last: mandatory }
  }
  return {
    first: preceding.slice(0, firstVonIdx).join(' '),
    von: preceding.slice(firstVonIdx, lastVonIdx + 1).join(' '),
    last: [...preceding.slice(lastVonIdx + 1), mandatory].join(' '),
  }
}

/**
 * A single BibTeX author name, parsed into its constituents (First, von, Last,
 * Suffix) from any of the three standard BibTeX name notations:
 *
 *   "First von Last"
 *   "von Last, First"
 *   "von Last, Suffix, First"
 */
export class BibtexName {
  readonly first: string
  readonly von: string
  readonly last: string
  readonly suffix: string

  constructor(raw: string) {
    const trimmed = raw.trim()
    const segments = trimmed.split(',').map(s => s.trim())
    if (segments.length >= 3) {
      // "von Last, Suffix, First"
      const { von, last } = parseVonLast(segments[0])
      this.von = von
      this.last = last
      this.suffix = segments[1]
      this.first = segments.slice(2).join(' ').trim()
    } else if (segments.length === 2) {
      // "von Last, First"
      const { von, last } = parseVonLast(segments[0])
      this.von = von
      this.last = last
      this.suffix = ''
      this.first = segments[1]
    } else {
      // "First von Last"
      const { first, von, last } = parseFirstVonLast(trimmed)
      this.first = first
      this.von = von
      this.last = last
      this.suffix = ''
    }
  }

  /** Returns the name in "First von Last Suffix" display order. */
  toFirstLast(): string {
    return [this.first, this.von, this.last, this.suffix]
      .filter(Boolean)
      .join(' ')
  }

  /** Returns the "von Last" component (without First or Suffix). */
  toLast(): string {
    return [this.von, this.last].filter(Boolean).join(' ')
  }

  /** Returns the name in "von Last, First" display order (BibTeX comma notation). */
  toLastFirst(): string {
    const vonLast = [this.von, this.last].filter(Boolean).join(' ')
    return this.first ? `${vonLast}, ${this.first}` : vonLast
  }
}

/**
 * A parsed BibTeX author/editor field. Names are split on " and "
 * (case-insensitive). If the last token is "others" (case-insensitive), it is
 * not included in `names` and `hasOthers` is set to `true` instead.
 *
 * Examples:
 *   "John Smith and Jane Doe"          → names=[Smith, Doe], hasOthers=false
 *   "John Smith and others"            → names=[Smith],      hasOthers=true
 *   "others"                           → names=[others],     hasOthers=false
 *   "others and John Smith"            → names=[others, Smith], hasOthers=false
 */
export class BibtexNameList {
  readonly names: BibtexName[]
  readonly hasOthers: boolean

  constructor(raw: string) {
    if (!raw.trim()) {
      this.names = []
      this.hasOthers = false
      return
    }
    const parts = raw
      .split(/\s+and\s+/i)
      .map(s => s.trim())
      .filter(Boolean)
    if (
      parts.length > 1 &&
      parts[parts.length - 1].toLowerCase() === 'others'
    ) {
      this.hasOthers = true
      this.names = parts.slice(0, -1).map(s => new BibtexName(s))
    } else {
      this.hasOthers = false
      this.names = parts.map(s => new BibtexName(s))
    }
  }

  /**
   * Joins the names into a formatted display string using the Oxford comma.
   * When `hasOthers` is true, renders "et al." in place of the omitted token.
   *
   * Examples with `format = n => n.toFirstLast()`:
   *   [Smith]          hasOthers=false  → "Jane Smith"
   *   [Smith, Doe]     hasOthers=false  → "Jane Smith and John Doe"
   *   [Smith, Doe, Jones]               → "Jane Smith, John Doe, and Bob Jones"
   *   [Smith]          hasOthers=true   → "Jane Smith et al."
   */
  join(format: (name: BibtexName) => string = n => n.toFirstLast()): string {
    const { names, hasOthers } = this
    if (names.length === 0) return ''
    const formatted = names.map(format)
    if (hasOthers) {
      if (formatted.length === 1) return `${formatted[0]} et al.`
      return `${formatted.join(', ')}, et al.`
    }
    if (formatted.length === 1) return formatted[0]
    if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`
    return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`
  }

  /**
   * All known authors, comma-joined (no "et al." truncation). Comma-only on
   * purpose: the result is fed through HighlightedText, so a fabricated "and"
   * would get <mark>ed for queries like "a"/"an" — never synthesise words.
   */
  joinPlain(
    format: (name: BibtexName) => string = n => n.toFirstLast()
  ): string {
    return this.names.map(format).join(', ')
  }

  /**
   * Returns a short author string using family names only. For 3+ names or
   * when `hasOthers` is true, returns the first surname followed by "et al.".
   * For exactly 2 names, joins their surnames with " & ".
   */
  summarize(): string {
    const { names, hasOthers } = this
    if (names.length === 0) return ''
    const surnames = names.map(n => [n.von, n.last].filter(Boolean).join(' '))
    if (hasOthers || surnames.length > 2) return `${surnames[0]} et al.`
    return surnames.join(' & ')
  }
}
