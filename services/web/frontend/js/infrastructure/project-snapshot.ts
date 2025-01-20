import pLimit from 'p-limit'
import { Change, Chunk, Snapshot } from 'overleaf-editor-core'
import { RawChange, RawChunk } from 'overleaf-editor-core/lib/types'
import { FetchError, getJSON, postJSON } from '@/infrastructure/fetch-json'

const DOWNLOAD_BLOBS_CONCURRENCY = 10

/**
 * Project snapshot container with on-demand refresh
 */
export class ProjectSnapshot {
  private projectId: string
  private snapshot: Snapshot
  private version: number
  private blobStore: SimpleBlobStore
  private refreshPromise: Promise<void>
  private initialized: boolean
  private refreshing: boolean
  private queued: boolean

  constructor(projectId: string) {
    this.projectId = projectId
    this.snapshot = new Snapshot()
    this.version = 0
    this.refreshPromise = Promise.resolve()
    this.initialized = false
    this.refreshing = false
    this.queued = false
    this.blobStore = new SimpleBlobStore(this.projectId)
  }

  /**
   * Request a refresh of the snapshot.
   *
   * When the returned promise resolves, the snapshot is guaranteed to have been
   * updated at least to the version of the document that was current when the
   * function was called.
   */
  async refresh() {
    if (this.queued) {
      // There already is a queued refresh that will run after this call.
      // Just wait for it to complete.
      await this.refreshPromise
    } else if (this.refreshing) {
      // There is a refresh running, but no queued refresh. Queue a refresh
      // after this one and make it the new promise to wait for.
      this.refreshPromise = this.queueRefresh()
      await this.refreshPromise
    } else {
      // There is no refresh running. Start one.
      this.refreshPromise = this.startRefresh()
      await this.refreshPromise
    }
  }

  /**
   * Get the list of paths to editable docs.
   */
  getDocPaths(): string[] {
    const allPaths = this.snapshot.getFilePathnames()
    return allPaths.filter(path => this.snapshot.getFile(path)?.isEditable())
  }

  /**
   * Get the doc content at the given path.
   */
  getDocContents(path: string): string | null {
    const file = this.snapshot.getFile(path)
    if (file == null) {
      return null
    }
    return file.getContent({ filterTrackedDeletes: true }) ?? null
  }

  /**
   * Immediately start a refresh
   */
  private async startRefresh() {
    this.refreshing = true
    try {
      if (!this.initialized) {
        await this.initialize()
      } else {
        await this.loadChanges()
      }
    } finally {
      this.refreshing = false
    }
  }

  /**
   * Queue a refresh after the currently running refresh
   */
  private async queueRefresh() {
    this.queued = true
    try {
      await this.refreshPromise
    } catch {
      // Ignore errors
    }
    this.queued = false
    await this.startRefresh()
  }

  /**
   * Initialize the snapshot using the project's latest chunk.
   *
   * This is run on the first refresh.
   */
  private async initialize() {
    await flushHistory(this.projectId)
    const chunk = await fetchLatestChunk(this.projectId)
    this.snapshot = chunk.getSnapshot()
    this.snapshot.applyAll(chunk.getChanges())
    this.version = chunk.getEndVersion()
    await this.loadDocs()
    this.initialized = true
  }

  /**
   * Apply changes since the last refresh.
   *
   * This is run on the second and subsequent refreshes
   */
  private async loadChanges() {
    await flushHistory(this.projectId)
    const changes = await fetchLatestChanges(this.projectId, this.version)
    this.snapshot.applyAll(changes)
    this.version += changes.length
    await this.loadDocs()
  }

  /**
   * Load all editable docs in the snapshot.
   *
   * This is done by converting any lazy file data into an "eager" file data. If
   * a doc is already loaded, the load is a no-op.
   */
  private async loadDocs() {
    const paths = this.getDocPaths()
    const limit = pLimit(DOWNLOAD_BLOBS_CONCURRENCY)
    await Promise.all(
      paths.map(path =>
        limit(async () => {
          const file = this.snapshot.getFile(path)
          await file?.load('eager', this.blobStore)
        })
      )
    )
  }
}

/**
 * Blob store that fetches blobs from the history service
 */
class SimpleBlobStore {
  private projectId: string

  constructor(projectId: string) {
    this.projectId = projectId
  }

  async getString(hash: string): Promise<string> {
    return await fetchBlob(this.projectId, hash)
  }

  async getObject(hash: string) {
    const blob = await this.getString(hash)
    return JSON.parse(blob)
  }
}

async function flushHistory(projectId: string) {
  await postJSON(`/project/${projectId}/flush`)
}

async function fetchLatestChunk(projectId: string): Promise<Chunk> {
  const response = await getJSON<{ chunk: RawChunk }>(
    `/project/${projectId}/latest/history`
  )
  return Chunk.fromRaw(response.chunk)
}

async function fetchLatestChanges(
  projectId: string,
  version: number
): Promise<Change[]> {
  const response = await getJSON<RawChange[]>(
    `/project/${projectId}/changes?since=${version}`
  )
  return response.map(Change.fromRaw).filter(change => change != null)
}

async function fetchBlob(projectId: string, hash: string): Promise<string> {
  const url = `/project/${projectId}/blob/${hash}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new FetchError('Failed to fetch blob', url, undefined, res)
  }
  return await res.text()
}
