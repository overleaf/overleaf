import { useEffect, useRef } from 'react'
import { sendMB } from '@/infrastructure/event-tracking'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { useIsNetworkStalledState } from '@/features/ide-react/hooks/use-is-network-stalled'
import {
  ConnectionOutageTracker,
  type ConnectionOutageRecord,
  type OutageResolution,
} from '@/features/ide-react/editor/connection-outage-tracker'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useProjectContext } from '@/shared/context/project-context'
import type { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'
import type { OpenDocuments } from '@/features/ide-react/editor/open-documents'

const EDIT_SNAPSHOT_INTERVAL_MS = 2_000
const MAX_RELOAD_RESTORE_MS = 24 * 60 * 60 * 1000

const offlineBackupEnabled = isSplitTestEnabled(
  'intermittent-connection-improvements'
)

type OutageProps = {
  detectedAt: number
  unsavedDurationMs: number
  outageDurationMs: number
  pendingChars: number
  inflightChars: number
}

// unsavedDurationMs runs from the oldest unacknowledged local op and is 0 when
// the outage carried no edits at all. outageDurationMs stays separate so that
// "long outage but no work at risk" and "long outage with unsaved work" are
// distinguishable in the data.
//
// detectedAt identifies the outage: it is set once and frozen for the record's
// lifetime, so user + page + detectedAt deduplicates a teardown reported both
// inline and again on the next load. It is a client clock, so comparing it
// against server-side event timestamps needs skew tolerance, and for a doc
// error that never stalled it is the teardown time rather than an outage onset
// (those rows have an outageDurationMs near zero).
function readOutageProps(
  record: ConnectionOutageRecord,
  endedAt = Date.now()
): OutageProps {
  return {
    detectedAt: record.detectedAt,
    unsavedDurationMs:
      record.oldestUnsavedOpAt === null
        ? 0
        : Math.floor(endedAt - record.oldestUnsavedOpAt),
    outageDurationMs: Math.floor(endedAt - record.detectedAt),
    pendingChars: record.pendingChars,
    inflightChars: record.inflightChars,
  }
}

// Op timestamps are on the performance.now() timeline, but the record survives
// reloads, so convert to epoch ms.
function getOldestUnsavedOpAt(openDocs: OpenDocuments): number | null {
  const oldestOpCreatedAt = openDocs.getOldestUnsavedOpCreatedAt()
  if (oldestOpCreatedAt === null) {
    return null
  }
  return Date.now() - (performance.now() - oldestOpCreatedAt)
}

// spannedReload is independent of the resolution: a reload during the outage
// discards the in-memory op queue, so the work only survived if the offline
// backup held it, however the outage went on to end.
//
// An outage that ended with no unsaved work is dropped, since we can't
// distinguish between someone reading while offline and an idle tab.
function emitOutageEnded(
  record: ConnectionOutageRecord,
  {
    resolution,
    spannedReload,
  }: { resolution: OutageResolution; spannedReload: boolean }
): void {
  const props = readOutageProps(record)
  if (props.pendingChars === 0 && props.inflightChars === 0) {
    return
  }
  sendMB('connection-restored', {
    ...props,
    resolution,
    spannedReload,
    offlineBackupEnabled,
  })
}

// Sent whether or not any work was unsaved: a teardown is terminal and rare,
// and one with no unsaved work is a doc error unrelated to connectivity, which
// needs to stay separable in the data.
function emitTeardown(
  record: ConnectionOutageRecord,
  spannedReload: boolean
): void {
  const { teardownAt } = record
  if (teardownAt === undefined) {
    return
  }
  sendMB('connection-restored', {
    ...readOutageProps(record, teardownAt),
    resolution: 'out-of-sync' satisfies OutageResolution,
    spannedReload,
    offlineBackupEnabled,
  })
}

export default function useConnectionOutageTracker(): void {
  const stalled = useIsNetworkStalledState()
  const { isConnected, connectionState } = useConnectionContext()
  const websocketDisconnected =
    !isConnected || connectionState.reconnectAt !== null
  const { openDocs } = useEditorManagerContext()
  const { eventEmitter, outOfSync } = useIdeReactContext()
  const { projectId } = useProjectContext()

  const prevWebsocketDisconnectedRef = useRef(websocketDisconnected)
  const prevStalledRef = useRef(stalled)
  // The socket starts out CLOSED, so every mount looks disconnected for a beat.
  // Nothing before the first connection is an outage.
  const hasConnectedRef = useRef(isConnected)
  // Set when this load picks up an outage that is still running from a previous
  // one, so the emit that eventually ends it can report that. Cleared with the
  // record, so a later outage in the same tab starts from false again.
  const spannedReloadRef = useRef(false)
  // The teardown record is deliberately not removed once flushed, so it cannot
  // double as the "already reported on this load" latch.
  const teardownFlushedRef = useRef(false)

  // RELOAD survival: Handle recovery after page refresh.
  //
  // Declared first so it reads the persisted record before START or SNAPSHOT
  // can touch it.
  useEffect(() => {
    const record = ConnectionOutageTracker.read(projectId)
    if (!record) return

    // Stale record from before MAX_RELOAD_RESTORE_MS, discard without emitting
    if (Date.now() - record.updatedAt > MAX_RELOAD_RESTORE_MS) {
      ConnectionOutageTracker.remove(projectId)
      return
    }

    // Ended in a terminal teardown on a previous load. That load may have
    // flushed it inline already, but had no way to tell whether the beacon
    // landed, so report it again here and let detectedAt collapse the pair.
    if (record.teardownAt !== undefined) {
      emitTeardown(record, true)
      ConnectionOutageTracker.remove(projectId)
      return
    }

    // Already recovered by mount time, emit and clean up
    if (!stalled) {
      emitOutageEnded(record, {
        resolution: 'reconnected',
        spannedReload: true,
      })
      ConnectionOutageTracker.remove(projectId)
      return
    }

    // Still stalled at mount, seed refs to detect upcoming recovery. This is the
    // only branch that leaves the outage running, so it is the only one whose
    // eventual emit has to report that the outage spanned a reload.
    spannedReloadRef.current = true
    prevWebsocketDisconnectedRef.current = true
    prevStalledRef.current = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // TEARDOWN: flush a terminal teardown as soon as it happens. The teardown
  // closes the websocket, but sendMB goes over HTTP, so it still gets through.
  // Deferring to the next load instead would lose the report whenever the modal
  // does not force a reload, which the treatment arm's modal never does.
  //
  // The record is left in place, because sendMB is fire-and-forget: a teardown
  // that happens while the machine is genuinely offline has no way of knowing
  // its beacon was dropped, so the next load has to report it again. That makes
  // delivery at-least-once, and the duplicate collapses on detectedAt.
  useEffect(() => {
    if (!outOfSync || teardownFlushedRef.current) {
      return
    }
    const record = ConnectionOutageTracker.read(projectId)
    if (!record || record.teardownAt === undefined) {
      return
    }
    teardownFlushedRef.current = true
    emitTeardown(record, spannedReloadRef.current)
  }, [outOfSync, projectId])

  useEffect(() => {
    if (isConnected) {
      hasConnectedRef.current = true
    }
  }, [isConnected])

  // START: Initialize tracking when stalled.
  //
  // Keep websocketDisconnected in the deps: stalled ORs it in, so a drop while
  // an earlier stall is unresolved leaves stalled true and this would not re-run,
  // losing the second outage.
  useEffect(() => {
    // Bail before reading the docs: that poll mutates per-doc state shared with
    // the unsaved-docs poll.
    if (
      !hasConnectedRef.current ||
      !stalled ||
      ConnectionOutageTracker.read(projectId)
    ) {
      return
    }
    ConnectionOutageTracker.start(projectId, getOldestUnsavedOpAt(openDocs))
  }, [stalled, websocketDisconnected, isConnected, projectId, openDocs])

  // SNAPSHOT: Record edits while offline
  useEffect(() => {
    if (!stalled) return

    const snapshot = () => {
      const { pendingChars, inflightChars } = openDocs.getUnsavedOpsSize()
      // No docs are open yet on the first tick after a reload, which reads as
      // zero unsaved work. Ops cannot drain while stalled, so a zero here is
      // never news and must not overwrite what a previous load recorded.
      if (pendingChars === 0 && inflightChars === 0) {
        return
      }
      ConnectionOutageTracker.recordEdits(
        projectId,
        pendingChars,
        inflightChars,
        getOldestUnsavedOpAt(openDocs)
      )
    }

    snapshot()
    const id = window.setInterval(snapshot, EDIT_SNAPSHOT_INTERVAL_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [stalled, projectId, openDocs])

  // FIRE (a): Emit on websocket reconnect. The edits may not have been
  // acknowledged yet, hence 'reconnected' rather than 'saved'.
  useEffect(() => {
    if (
      prevWebsocketDisconnectedRef.current === true &&
      websocketDisconnected === false
    ) {
      const record = ConnectionOutageTracker.read(projectId)
      if (record && record.teardownAt === undefined) {
        emitOutageEnded(record, {
          resolution: 'reconnected',
          spannedReload: spannedReloadRef.current,
        })
        ConnectionOutageTracker.remove(projectId)
        spannedReloadRef.current = false
      }
    }
    prevWebsocketDisconnectedRef.current = websocketDisconnected
  }, [websocketDisconnected, projectId])

  // FIRE (b): Emit when the stall clears without the socket having dropped,
  // which means the ops were finally acknowledged on the existing connection.
  useEffect(() => {
    if (prevStalledRef.current === true && stalled === false) {
      const record = ConnectionOutageTracker.read(projectId)
      if (record && record.teardownAt === undefined) {
        emitOutageEnded(record, {
          resolution: 'saved',
          spannedReload: spannedReloadRef.current,
        })
        ConnectionOutageTracker.remove(projectId)
        spannedReloadRef.current = false
      }
    }
    prevStalledRef.current = stalled
  }, [stalled, projectId])

  // SYNC OUTCOME: Emit whether the offline edits made it back to the server
  useEffect(() => {
    const onSynced = (
      event: CustomEvent<IdeEvents['ide:offlineChangesSynced']>
    ) => {
      const [{ docId }] = event.detail
      sendMB('post-offline-sync-succeeded', { docId })
    }

    const onFailed = (
      event: CustomEvent<IdeEvents['ide:unableToSyncOfflineChanges']>
    ) => {
      const [{ docId }] = event.detail
      sendMB('post-offline-sync-failed', { docId })
    }

    eventEmitter.on('ide:offlineChangesSynced', onSynced)
    eventEmitter.on('ide:unableToSyncOfflineChanges', onFailed)

    return () => {
      eventEmitter.off('ide:offlineChangesSynced', onSynced)
      eventEmitter.off('ide:unableToSyncOfflineChanges', onFailed)
    }
  }, [eventEmitter, projectId])
}
