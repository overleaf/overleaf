import { ReferenceIndex } from './reference-index'
import { Changes } from './types'

export default class BasicReferenceIndex extends ReferenceIndex {
  fileIndex: Map<string, Set<string>> = new Map()

  updateIndex({ updates, deletes }: Changes): Set<string> {
    for (const path of deletes) {
      this.fileIndex.delete(path)
    }
    for (const { path, content } of updates) {
      const fileReferences: Set<string> = new Set()
      const entries = this.parseEntries(content)
      for (const entry of entries) {
        fileReferences.add(entry.EntryKey)
      }
      this.fileIndex.set(path, fileReferences)
    }
    this.keys = new Set(
      this.fileIndex.values().flatMap(entry => Array.from(entry))
    )
    return this.keys
  }
}
