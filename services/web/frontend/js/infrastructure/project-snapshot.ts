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
  private state: 'init' | 'refreshing' | 'ready'
  private blobStore: SimpleBlobStore

  constructor(projectId: string) {
    this.projectId = projectId
    this.snapshot = new Snapshot()
    this.version = 0
    this.state = 'init'
    this.blobStore = new SimpleBlobStore(this.projectId)
  }

  async refresh() {
    if (this.state === 'refreshing') {
      // Prevent concurrent refreshes
      return
    }

    await flushHistory(this.projectId)

    if (this.state === 'init') {
      const chunk = await fetchLatestChunk(this.projectId)
      this.snapshot = chunk.getSnapshot()
      this.snapshot.applyAll(chunk.getChanges())
      this.version = chunk.getEndVersion()
    } else {
      const changes = await fetchLatestChanges(this.projectId, this.version)
      this.snapshot.applyAll(changes)
      this.version += changes.length
    }

    this.state = 'ready'
    await this.loadDocs()
  }

  getDocPaths(): string[] {
    const allPaths = this.snapshot.getFilePathnames()
    return allPaths.filter(path => this.snapshot.getFile(path)?.isEditable())
  }

  getDocContents(path: string): string | null {
    const file = this.snapshot.getFile(path)
    if (file == null) {
      return null
    }
    return file.getContent({ filterTrackedDeletes: true }) ?? null
  }

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
