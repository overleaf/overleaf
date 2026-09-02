import customSessionStorage from '@/infrastructure/session-storage'
import getMeta from '@/utils/meta'

const KEY_PREFIX = 'conn.outage.'

export type OutageResolution = 'reconnected' | 'saved' | 'out-of-sync'

export type ConnectionOutageRecord = {
  projectId: string
  detectedAt: number
  oldestUnsavedOpAt: number | null
  pendingChars: number
  inflightChars: number
  updatedAt: number
  teardownAt?: number
}

export class ConnectionOutageTracker {
  static buildKey(projectId: string): string {
    const userId = getMeta('ol-user_id') ?? 'anonymous'
    return `${KEY_PREFIX}${userId}.${projectId}`
  }

  static read(projectId: string): ConnectionOutageRecord | null {
    return customSessionStorage.getItem(this.buildKey(projectId))
  }

  static remove(projectId: string): void {
    customSessionStorage.removeItem(this.buildKey(projectId))
  }

  private static write(record: ConnectionOutageRecord): void {
    customSessionStorage.setItem(this.buildKey(record.projectId), record)
  }

  // Sweep every user's records on logout. sessionStorage is per-tab and can't
  // be reached from the tab that handles logout for any other tab, so we clear
  // the whole prefix here rather than scoping to the current user.
  static clearAll(): void {
    customSessionStorage.removeByPrefix(KEY_PREFIX)
  }

  // Begin an outage. No-op if a record already exists, preserving the original
  // timestamps (epoch ms) across reloads and repeated stalled ticks.
  static start(projectId: string, oldestUnsavedOpAt: number | null): void {
    if (this.read(projectId)) {
      return
    }
    this.write({
      projectId,
      detectedAt: Date.now(),
      oldestUnsavedOpAt,
      pendingChars: 0,
      inflightChars: 0,
      updatedAt: Date.now(),
    })
  }

  // Snapshot current unsaved edit sizes while offline. Ops flush on reconnect,
  // so the live sizes are gone by restore time; persist them here.
  //
  // oldestUnsavedOpAt is backfilled the first time an op appears mid-outage:
  // START runs before the user has typed on an idle drop, so the field is null
  // then, and unsavedDurationMs would otherwise stay zero even once edits pile up.
  static recordEdits(
    projectId: string,
    pendingChars: number,
    inflightChars: number,
    oldestUnsavedOpAt: number | null
  ): void {
    const record = this.read(projectId)
    // A torn-down record is final: its edit sizes belong to the teardown moment,
    // and its updatedAt has to stop moving so the staleness cap can expire it.
    // The stall never clears after a teardown, so the snapshot interval keeps
    // running and would otherwise overwrite both.
    if (!record || record.teardownAt !== undefined) {
      return
    }
    // Each field only ever grows during a genuine stall, because ops cannot
    // drain without a working connection. A drop therefore means the recovery
    // flush has begun and the snapshot is measuring that, not the outage: an ack
    // nulls the inflight op a flush delay before the next pending op is
    // promoted, so a snapshot landing in that gap reads zero inflight while
    // pending is still full.
    record.pendingChars = Math.max(record.pendingChars, pendingChars)
    record.inflightChars = Math.max(record.inflightChars, inflightChars)
    if (record.oldestUnsavedOpAt === null && oldestUnsavedOpAt !== null) {
      record.oldestUnsavedOpAt = oldestUnsavedOpAt
    }
    record.updatedAt = Date.now()
    this.write(record)
  }

  // Mark an outage as ended by a terminal out-of-sync teardown. Reporting is
  // left to the hook, which flushes the record as soon as it sees the teardown
  // and again on the next load, since a teardown that happens while offline
  // cannot tell that its report was dropped.
  //
  // Upserts, because a doc error unrelated to connectivity gets here before any
  // stall is detected. Those records have no unsaved op timestamp, which is what
  // separates them from a genuine outage.
  static recordTeardown(projectId: string): void {
    const record = this.read(projectId) ?? {
      projectId,
      detectedAt: Date.now(),
      oldestUnsavedOpAt: null,
      pendingChars: 0,
      inflightChars: 0,
      updatedAt: Date.now(),
    }
    if (record.teardownAt !== undefined) {
      return
    }
    record.teardownAt = Date.now()
    record.updatedAt = Date.now()
    this.write(record)
  }
}
