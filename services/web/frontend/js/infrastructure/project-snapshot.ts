import pLimit from 'p-limit'
import { Change, Chunk, Snapshot, File } from 'overleaf-editor-core'
import { RawChange, RawChunk } from 'overleaf-editor-core/lib/types'
import { FetchError, getJSON, postJSON } from '@/infrastructure/fetch-json'
import path from 'path-browserify'

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
   * Get the list of paths to binary files.
   */
  getBinaryFilePathsWithHash(): { path: string; hash: string; size: number }[] {
    const allPaths = this.snapshot.getFilePathnames()
    const paths = []
    for (const path of allPaths) {
      const file = this.snapshot.getFile(path)
      if (file == null || file.isEditable()) {
        continue
      }
      const hash = file.getHash()
      const size = file.getByteLength()
      if (hash == null) {
        continue
      }
      if (size == null) {
        continue
      }
      paths.push({ path, hash, size })
    }
    return paths
  }

  /**
   * Use an algorithm similar to Kpathsea to locate files in the project snapshot:
   *
   * 1. look for the exact path relative to the root path
   * 2. look for the path + extension relative to the root path
   * 3. look for the exact path relative to the current path
   * 4. look for the path + extension relative to the current path
   */
  locateFile(filePath: string, currentPath = '/', extensions = ['.tex']) {
    // ignore absolute paths
    if (filePath.startsWith('/')) {
      return null
    }

    const snapshotPaths = new Set(this.snapshot.getFilePathnames())

    const basePaths = [
      // relative to the root of the compile directory
      '/',
    ]

    if (currentPath !== '/') {
      // relative to the current directory
      basePaths.push(currentPath)
    }

    const extensionsToTest = ['', ...extensions]

    for (const basePath of basePaths) {
      for (const extension of extensionsToTest) {
        const pathname = path.resolve(basePath, `${filePath}${extension}`)
        const snapshotPath = pathname.substring(1) // remove leading slash
        if (snapshotPaths.has(snapshotPath)) {
          return snapshotPath
        }
      }
    }

    return null
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

  async getBinaryFileContents(
    path: string,
    options?: { maxSize?: number }
  ): Promise<any> {
    const file = this.snapshot.getFile(path)
    const hash = file?.getHash()
    const byteLength = file?.getByteLength()
    if (hash == null) {
      return null
    }
    if (byteLength == null) {
      return null
    }
    let blobStoreOptions
    if (options?.maxSize != null && byteLength > options?.maxSize) {
      blobStoreOptions = { maxSize: options.maxSize }
    }
    return await this.blobStore.getString(hash, blobStoreOptions)
  }

  getDocs(): Map<string, File> {
    const files = new Map()
    for (const path of this.snapshot.getFilePathnames()) {
      const file = this.snapshot.getFile(path)
      if (file?.isEditable()) {
        files.set(path, file)
      }
    }
    return files
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
    let hasMore = true
    while (hasMore) {
      const response = await fetchLatestChanges(this.projectId, this.version)
      const changes = response.changes
      this.snapshot.applyAll(changes)
      this.version += changes.length
      hasMore = response.hasMore
    }

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

  async getString(
    hash: string,
    options?: { maxSize?: number }
  ): Promise<string> {
    return await fetchBlob(this.projectId, hash, options)
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

type FetchLatestChangesResponse = {
  changes: Change[]
  hasMore: boolean
}

type FetchLatestChangesApiResponse =
  | RawChange[]
  | {
      changes: RawChange[]
      hasMore: boolean
    }

async function fetchLatestChanges(
  projectId: string,
  version: number
): Promise<FetchLatestChangesResponse> {
  // TODO: The paginated flag is a transition flag. It can be removed after this
  // code has been deployed for a few weeks.
  const response = await getJSON<FetchLatestChangesApiResponse>(
    `/project/${projectId}/changes?since=${version}&paginated=true`
  )

  let changes, hasMore
  if (Array.isArray(response)) {
    // deprecated response format is a simple array of changes
    // TODO: Remove this branch after the transition
    changes = response
    hasMore = false
  } else {
    changes = response.changes
    hasMore = response.hasMore
  }

  return {
    changes: changes.map(Change.fromRaw).filter(change => change != null),
    hasMore,
  }
}

async function fetchBlob(
  projectId: string,
  hash: string,
  options?: { maxSize?: number }
): Promise<string> {
  const url = `/project/${projectId}/blob/${hash}`
  let fetchOpts
  if (options?.maxSize === 0) {
    return ''
  }
  if (options?.maxSize) {
    fetchOpts = {
      headers: {
        Range: `bytes=0-${options.maxSize - 1}`,
      },
    }
  }
  const res = await fetch(url, fetchOpts)
  if (!res.ok) {
    throw new FetchError('Failed to fetch blob', url, undefined, res)
  }
  return await res.text()
}
