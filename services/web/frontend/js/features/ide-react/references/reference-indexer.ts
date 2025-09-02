import { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import { generateSHA1Hash } from '@/shared/utils/sha1'
import { AdvancedReferenceSearchResult, Changes } from './types'
import { debugConsole } from '@/utils/debugging'
import type { ReferenceWorkerResponse } from './references.worker'

const ONE_MB = 1024 * 1024
const MAX_BIB_DATA_SIZE = 6 * ONE_MB

export class ReferenceIndexer {
  private fileIndexHash: Map<string, string> = new Map()
  private worker: Worker
  private updateResolve: ((result: Set<string>) => void) | null = null
  private searchResolve:
    | ((result: AdvancedReferenceSearchResult) => void)
    | null = null

  constructor() {
    this.worker = new Worker(
      /* webpackChunkName: "references-worker" */
      new URL('./references.worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.addEventListener('message', evt => this.handleMessage(evt))
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data as ReferenceWorkerResponse
    if (data.type === 'searchResult' && this.searchResolve) {
      this.searchResolve(data.result)
      this.searchResolve = null
    } else if (data.type === 'updateKeys' && this.updateResolve) {
      this.updateResolve(data.keys)
      this.updateResolve = null
    } else {
      debugConsole.warn('Received unknown message from worker:', data.type)
    }
  }

  async updateFromSnapshot(
    snapshot: Pick<
      ProjectSnapshot,
      | 'getDocPaths'
      | 'getDocContents'
      | 'getBinaryFilePathsWithHash'
      | 'getBinaryFileContents'
    >,
    {
      dataLimit = MAX_BIB_DATA_SIZE,
      signal,
    }: { dataLimit?: number; signal: AbortSignal }
  ): Promise<Set<string>> {
    const nextFileHashIndex = new Map(this.fileIndexHash)
    const previousPaths = new Set(this.fileIndexHash.keys())
    let dataBudget = dataLimit
    const docs = snapshot
      .getDocPaths()
      .filter(path => path.toLowerCase().endsWith('.bib'))

    const changes: Changes = { updates: [], deletes: [] }
    for (const path of docs) {
      previousPaths.delete(path)
      if (dataBudget <= 0) {
        continue
      }
      const content = snapshot.getDocContents(path)?.slice(0, dataBudget)
      if (content == null) {
        continue
      }
      dataBudget -= content.length
      const hash = generateSHA1Hash(content)
      const possibleMatch = nextFileHashIndex.get(path)
      if (possibleMatch === undefined || possibleMatch !== hash) {
        // New or changed file
        nextFileHashIndex.set(path, hash)
        changes.updates.push({ path, content })
      }
    }

    const files = snapshot
      .getBinaryFilePathsWithHash()
      .filter(({ path }) => path.toLowerCase().endsWith('.bib'))
      .sort((a, b) => a.size - b.size)

    for (const { path, hash, size } of files) {
      if (signal.aborted) {
        debugConsole.warn('Aborted indexing references due to signal')
        return new Set()
      }

      previousPaths.delete(path)
      if (nextFileHashIndex.get(path) === hash) {
        dataBudget -= size
        // Already indexed
        continue
      }
      if (dataBudget <= 0) {
        continue
      }
      const content = await snapshot.getBinaryFileContents(path, {
        maxSize: dataBudget,
      })
      dataBudget -= content.length
      nextFileHashIndex.set(path, hash)
      changes.updates.push({ path, content })
    }

    previousPaths.forEach(path => {
      // Deleted file
      changes.deletes.push(path)
      nextFileHashIndex.delete(path)
    })

    if (dataBudget <= 0) {
      debugConsole.warn('Data budget exceeded while updating references index')
    }

    this.fileIndexHash = nextFileHashIndex

    this.worker.postMessage({
      type: 'update',
      changes,
    })

    return new Promise(resolve => {
      this.updateResolve = resolve
    })
  }

  async search(query: string): Promise<AdvancedReferenceSearchResult> {
    this.worker.postMessage({ type: 'search', query })
    const { promise, resolve } =
      Promise.withResolvers<AdvancedReferenceSearchResult>()
    this.searchResolve = resolve
    return promise
  }
}
