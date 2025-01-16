import pLimit from 'p-limit'
import OError from '@overleaf/o-error'
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
  private queuedRefreshPromise: Promise<void>
  private state: ProjectSnapshotState

  constructor(projectId: string) {
    this.projectId = projectId
    this.snapshot = new Snapshot()
    this.version = 0
    this.refreshPromise = Promise.resolve()
    this.queuedRefreshPromise = Promise.resolve()
    this.state = new ProjectSnapshotState()
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
    switch (this.state.getState()) {
      case 'init':
        this.refreshPromise = this.initialize()
        await this.refreshPromise
        break

      case 'ready':
        this.refreshPromise = this.loadChanges()
        await this.refreshPromise
        break

      case 'refreshing':
        this.queuedRefreshPromise = this.queueRefresh()
        await this.queuedRefreshPromise
        break

      case 'queued-ready':
      case 'queued-waiting':
        await this.queuedRefreshPromise
        break

      default:
        throw new OError('Unknown state for project snapshot', {
          state: this.state.getState(),
        })
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
   * Initialize the snapshot using the project's latest chunk.
   *
   * This is run on the first refresh.
   */
  private async initialize() {
    this.state.startRefresh()
    await flushHistory(this.projectId)
    const chunk = await fetchLatestChunk(this.projectId)
    this.snapshot = chunk.getSnapshot()
    this.snapshot.applyAll(chunk.getChanges())
    this.version = chunk.getEndVersion()
    await this.loadDocs()
    this.state.endRefresh()
  }

  /**
   * Apply changes since the last refresh.
   *
   * This is run on the second and subsequent refreshes
   */
  private async loadChanges() {
    this.state.startRefresh()
    await flushHistory(this.projectId)
    const changes = await fetchLatestChanges(this.projectId, this.version)
    this.snapshot.applyAll(changes)
    this.version += changes.length
    await this.loadDocs()
    this.state.endRefresh()
  }

  /**
   * Wait for the current refresh to complete, then start a refresh.
   */
  private async queueRefresh() {
    this.state.queueRefresh()
    await this.refreshPromise
    await this.loadChanges()
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
 * State machine for the project snapshot
 *
 * There are 5 states:
 *
 * - init: when the snapshot is built
 * - refreshing: while the snapshot is refreshing
 * - queued-waiting: while the snapshot is refreshing and another refresh is queued
 * - queued-ready: when a refresh is queued, but no refresh is running
 * - ready: when no refresh is running and no refresh is queued
 *
 * There are three transitions:
 *
 * - start: start a refresh operation
 * - end: end a refresh operation
 * - queue: queue a refresh operation
 *
 * Valid transitions are as follows:
 *
 *                       +------------+
 *                       |   ready    |
 *                       +------------+
 *                         ^       |
 *                         |       |
 *                        end    start
 *                         |       |
 *                         |       v
 * +------+              +------------+             +----------------+
 * | init |----start---->| refreshing |---queue---> | queued-waiting |
 * +------+              +------------+             +----------------+
 *                             ^                             |
 *                             |                             |
 *                           start                          end
 *                             |                             |
 *                             |     +--------------+        |
 *                             +-----| queued-ready |<-------+
 *                                   +--------------+
 *
 * These transitions ensure that there are never two refreshes running
 * concurrently. In every path, "start" and "end" transitions always alternate.
 * You never have two consecutive "start" or two consecutive "end".
 */
class ProjectSnapshotState {
  private state:
    | 'init'
    | 'refreshing'
    | 'ready'
    | 'queued-waiting'
    | 'queued-ready' = 'init'

  getState() {
    return this.state
  }

  startRefresh() {
    switch (this.state) {
      case 'init':
      case 'ready':
      case 'queued-ready':
        this.state = 'refreshing'
        break

      default:
        throw new OError("Can't start a snapshot refresh in this state", {
          state: this.state,
        })
    }
  }

  endRefresh() {
    switch (this.state) {
      case 'refreshing':
        this.state = 'ready'
        break

      case 'queued-waiting':
        this.state = 'queued-ready'
        break

      default:
        throw new OError("Can't end a snapshot refresh in this state", {
          state: this.state,
        })
    }
  }

  queueRefresh() {
    switch (this.state) {
      case 'refreshing':
        this.state = 'queued-waiting'
        break

      default:
        throw new OError("Can't queue a snapshot refresh in this state", {
          state: this.state,
        })
    }
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
