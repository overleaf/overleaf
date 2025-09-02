import Bib2Json from './bib2json'
import { AdvancedReferenceSearchResult, Bib2JsonEntry, Changes } from './types'

export abstract class ReferenceIndex {
  keys: Set<string> = new Set()

  abstract updateIndex({ updates, deletes }: Changes): void
  async search(_query: string): Promise<AdvancedReferenceSearchResult> {
    return { hits: [] }
  }

  getKeys(): Set<string> {
    return this.keys
  }

  parseEntries(content: string): Bib2JsonEntry[] {
    const allowedFields = ['author', 'journal', 'title', 'year', 'date']
    // @ts-expect-error Bib2Json works as both a constructor and a function
    const { entries } = Bib2Json(content, allowedFields)
    for (const entry of entries) {
      if (entry.Fields?.year) {
        entry.Fields.year = parseInt(entry.Fields.year).toString()
        if (entry.Fields.year === 'NaN') {
          delete entry.Fields.year
        }
      }
      setDefaultFields(entry.Fields)
    }
    return entries
  }
}

function setDefaultFields(
  fields: Partial<Bib2JsonEntry['Fields']>
): Bib2JsonEntry['Fields'] {
  const requiredFields = ['author', 'journal', 'title', 'date', 'year'] as const
  for (const field of requiredFields) {
    if (!fields[field]) {
      fields[field] = ''
    }
  }
  return fields as Bib2JsonEntry['Fields']
}
