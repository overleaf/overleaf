import customSessionStorage from '@/infrastructure/session-storage'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import getMeta from '@/utils/meta'
import { ShareJsDoc } from './share-js-doc'
import { ShareJsOperation } from './types/document'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'

const EVENT_NAMESPACE = 'offlineBackup'
const OFFLINE_BACKUP_INTERVAL_MS = 2000
const KEY_PREFIX = 'doc.offline-backup.'
const STALL_AFTER_SECONDS = 10

type Baseline = {
  version: number
  snapshot: string | null
}

export type OfflineDocBackupRecord = {
  docId: string
  projectId: string
  version: number
  snapshot: string
  inflightOp: ShareJsOperation | null
  pendingOp: ShareJsOperation | null
  trackChanges: boolean
  updatedAt: number
  inflightSubmittedIds: string[]
}

/**
 * Periodically persists, per open document, the baseline snapshot (V_start)
 * plus local edits to sessionStorage while the client is offline
 */
export class OfflineDocBackup {
  private readonly enabled: boolean
  private readonly key: string
  private baseline: Baseline | null = null
  private throttleTimer: number | null = null

  static buildKey(projectId: string, docId: string): string {
    const userId = getMeta('ol-user_id') ?? 'anonymous'
    return `${KEY_PREFIX}${userId}.${projectId}.${docId}`
  }

  static read(projectId: string, docId: string): OfflineDocBackupRecord | null {
    return customSessionStorage.getItem(
      OfflineDocBackup.buildKey(projectId, docId)
    )
  }

  // Whether a stored record is eligible to be replayed onto the live doc. The
  // unable-to-sync modal is only correct for docs we actually tried to recover,
  // so read-side callers must agree with the recovery path on eligibility.
  static readRecoverable(
    projectId: string,
    docId: string
  ): OfflineDocBackupRecord | null {
    if (!isSplitTestEnabled('intermittent-connection-improvements')) {
      return null
    }
    return OfflineDocBackup.read(projectId, docId)
  }

  static remove(projectId: string, docId: string): void {
    customSessionStorage.removeItem(OfflineDocBackup.buildKey(projectId, docId))
  }

  // Sweep every user's records. sessionStorage is per-tab and can't be reached
  // from the tab that handles logout for any other tab, so we clear the whole
  // prefix here rather than scoping to the current user.
  static clearAll(): void {
    customSessionStorage.removeByPrefix(KEY_PREFIX)
  }

  constructor(
    private readonly doc: ShareJsDoc,
    private readonly projectId: string,
    private readonly ideEventEmitter: IdeEventEmitter
  ) {
    this.enabled = isSplitTestEnabled('intermittent-connection-improvements')
    this.key = OfflineDocBackup.buildKey(projectId, doc.doc_id)

    if (!this.enabled) {
      return
    }

    this.refreshBaseline()

    this.onSaved = this.onSaved.bind(this)
    this.onDocChange = this.onDocChange.bind(this)

    this.doc.on(`saved.${EVENT_NAMESPACE}`, this.onSaved)
    this.doc.on(`change.${EVENT_NAMESPACE}`, this.onDocChange)
    this.doc.on(`acknowledge.${EVENT_NAMESPACE}`, this.onDocChange)
    this.doc.on(
      `flipped_pending_to_inflight.${EVENT_NAMESPACE}`,
      this.onDocChange
    )
  }

  private isOffline() {
    return this.doc.connection.state !== 'ok'
  }

  private isSavingStalled() {
    const oldestOpCreatedAt =
      this.doc.getInflightOpCreatedAt() ?? this.doc.getPendingOpCreatedAt()
    if (!oldestOpCreatedAt) {
      return false
    }
    const unsavedSeconds = (performance.now() - oldestOpCreatedAt) / 1000
    return unsavedSeconds > STALL_AFTER_SECONDS
  }

  private shouldBackup() {
    return this.isOffline() || this.isSavingStalled()
  }

  private refreshBaseline() {
    // baseline is the clean server state, buffered ops would
    // bake local edits into V_start and corrupt recovery
    if (this.doc.hasBufferedOps()) {
      return
    }
    this.baseline = {
      version: this.doc.getVersion(),
      snapshot: this.serializeSnapshot(),
    }
  }

  private serializeSnapshot(): string | null {
    // TODO: support history-ot
    if (this.doc.getType() !== 'sharejs-text-ot') {
      return null
    }
    return this.doc.getSnapshot()
  }

  // A stored record means this doc carried edits made while offline, so the
  // server acknowledging them here is the point at which the sync succeeded.
  // This covers both reconnecting with the doc still open and recovering the
  // backup after a reload.
  private onSaved() {
    const hadOfflineEdits =
      OfflineDocBackup.read(this.projectId, this.doc.doc_id) !== null
    this.refreshBaseline()
    this.clear()

    if (!hadOfflineEdits) {
      return
    }
    this.ideEventEmitter.emit('ide:offlineChangesSynced', {
      docId: this.doc.doc_id,
    })
  }

  private onDocChange() {
    // While online, keep the baseline in step with the server so V_start
    // reflects remote ops applied before we go offline. refreshBaseline no-ops
    // once there are buffered ops, freezing the baseline at the point we start
    // diverging offline.
    if (!this.shouldBackup()) {
      this.refreshBaseline()
      return
    }
    if (!this.doc.hasBufferedOps()) {
      return
    }
    if (this.throttleTimer !== null) {
      return
    }
    this.throttleTimer = window.setTimeout(() => {
      this.throttleTimer = null
      if (this.shouldBackup() && this.doc.hasBufferedOps()) {
        this.write()
      }
    }, OFFLINE_BACKUP_INTERVAL_MS)
  }

  private write() {
    if (!this.baseline || this.baseline.snapshot === null) {
      return
    }
    const record: OfflineDocBackupRecord = {
      docId: this.doc.doc_id,
      projectId: this.projectId,
      version: this.baseline.version,
      snapshot: this.baseline.snapshot,
      inflightOp: this.doc.getInflightOp(),
      pendingOp: this.doc.getPendingOp(),
      // A toggle can't take effect while we are offline: syncTrackChangesState
      // defers it until the buffer has drained, so this is still the state every
      // buffered op was made under.
      trackChanges: this.doc.track_changes,
      updatedAt: Date.now(),
      inflightSubmittedIds: Array.from(this.doc.getInflightSubmittedIds()),
    }
    customSessionStorage.setItem(this.key, record)
  }

  private clear() {
    customSessionStorage.removeItem(this.key)
  }

  disconnect() {
    if (!this.enabled) {
      return
    }
    if (this.throttleTimer !== null) {
      window.clearTimeout(this.throttleTimer)
      this.throttleTimer = null
    }
    this.doc.off(`saved.${EVENT_NAMESPACE}`)
    this.doc.off(`change.${EVENT_NAMESPACE}`)
    this.doc.off(`acknowledge.${EVENT_NAMESPACE}`)
    this.doc.off(`flipped_pending_to_inflight.${EVENT_NAMESPACE}`)

    // Don't clear the stored record here. This also runs when the doc is torn
    // down after a fatal timeout / out-of-sync error, which is when we need the
    // backup to survive so it can be recovered on reload. Only `saved` clears
    // it, once the server confirms our edits are stored.
  }
}
