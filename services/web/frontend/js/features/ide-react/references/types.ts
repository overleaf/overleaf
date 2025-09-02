export type Bib2JsonEntry = {
  EntryKey: string
  Fields: {
    author: string
    date: string
    journal: string
    title: string
    year: string
  }
}

export type AdvancedReferenceSearchResult = {
  hits: {
    _source: Bib2JsonEntry
  }[]
}

export type ReferenceEntry = Map<string, Bib2JsonEntry>

export type Changes = {
  updates: { path: string; content: string }[]
  deletes: string[]
}
