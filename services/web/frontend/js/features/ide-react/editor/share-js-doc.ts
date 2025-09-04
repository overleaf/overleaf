/* eslint-disable camelcase */
// Migrated from services/web/frontend/js/ide/editor/ShareJsDoc.js

import EventEmitter from '../../../utils/EventEmitter'
import sharejs, { Doc } from '@/vendor/libs/sharejs'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { debugConsole } from '@/utils/debugging'
import { decodeUtf8 } from '@/utils/decode-utf8'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import {
  Message,
  ShareJsConnectionState,
  ShareJsOperation,
  TrackChangesIdSeeds,
} from '@/features/ide-react/editor/types/document'
import { EditorFacade } from '@/features/source-editor/extensions/realtime'
import { recordDocumentFirstChangeEvent } from '@/features/event-tracking/document-first-change-event'
import getMeta from '@/utils/meta'
import { historyOTType } from './share-js-history-ot-type'
import {
  StringFileData,
  TrackedChangeList,
  EditOperationBuilder,
  CommentList,
} from 'overleaf-editor-core'
import {
  StringFileRawData,
  RawEditOperation,
} from 'overleaf-editor-core/lib/types'
import { HistoryOTShareDoc } from '../../../../../types/share-doc'

// All times below are in milliseconds
const SINGLE_USER_FLUSH_DELAY = 2000
const MULTI_USER_FLUSH_DELAY = 500
const INFLIGHT_OP_TIMEOUT = 5000 // Retry sending ops after 5 seconds without an ack
const WAIT_FOR_CONNECTION_TIMEOUT = 500
const FATAL_OP_TIMEOUT = 45000
const RECENT_ACK_LIMIT = 2 * SINGLE_USER_FLUSH_DELAY

type Update = Record<string, any>
export type OTType = 'sharejs-text-ot' | 'history-ot'

type Connection = {
  send: (update: Update) => void
  state: ShareJsConnectionState
  id: string
}

export class ShareJsDoc extends EventEmitter {
  track_changes = false
  track_changes_id_seeds: TrackChangesIdSeeds | null = null
  connection: Connection

  // @ts-ignore
  _doc: Doc
  private editorWatchdogManager: EditorWatchdogManager
  private lastAcked: number | null = null
  private pendingOpCreatedAt: number | null = null
  private inflightOpCreatedAt: number | null = null
  private queuedMessageTimer: number | null = null
  private queuedMessages: Message[] = []
  private detachEditorWatchdogManager: (() => void) | null = null
  private _timeoutTimer: number | null = null

  constructor(
    readonly doc_id: string,
    docLines: string[],
    version: number,
    readonly socket: Socket,
    private readonly globalEditorWatchdogManager: EditorWatchdogManager,
    private readonly eventEmitter: IdeEventEmitter,
    readonly type: OTType = 'sharejs-text-ot'
  ) {
    super()
    let sharejsType
    // Decode any binary bits of data
    let snapshot: string | StringFileData
    if (this.type === 'history-ot') {
      snapshot = StringFileData.fromRaw(
        docLines as unknown as StringFileRawData
      )
      sharejsType = historyOTType
    } else {
      snapshot = docLines.map(line => decodeUtf8(line)).join('\n')
      sharejsType = sharejs.types.text
    }

    this.connection = {
      send: (update: Update) => {
        this.startInflightOpTimeout(update)
        if (this.track_changes && this.track_changes_id_seeds) {
          if (update.meta == null) {
            update.meta = {}
          }
          update.meta.tc = this.track_changes_id_seeds.inflight
        }
        return this.socket.emit(
          'applyOtUpdate',
          this.doc_id,
          update,
          (error: Error) => {
            if (error != null) {
              this.handleError(error)
            }
          }
        )
      },
      state: 'ok',
      id: this.socket.publicId,
    }

    this._doc = new Doc(this.connection, this.doc_id, {
      type: sharejsType,
    })
    this._doc.setFlushDelay(SINGLE_USER_FLUSH_DELAY)
    this._doc.on('change', (...args: any[]) => {
      const isRemote = args[3]
      if (!isRemote && !this.pendingOpCreatedAt) {
        debugConsole.log('set pendingOpCreatedAt', new Date())
        this.pendingOpCreatedAt = performance.now()
      }
      return this.trigger('change', ...args)
    })
    this.editorWatchdogManager = new EditorWatchdogManager({
      parent: globalEditorWatchdogManager,
    })
    this._doc.on('acknowledge', () => {
      this.lastAcked = performance.now() // note time of last ack from server for an op we sent
      this.inflightOpCreatedAt = null
      debugConsole.log('unset inflightOpCreatedAt')
      this.editorWatchdogManager.onAck() // keep track of last ack globally
      return this.trigger('acknowledge')
    })
    this._doc.on('remoteop', (...args: any[]) => {
      // As soon as we're working with a collaborator, start sending
      // ops more frequently for low latency.
      this._doc.setFlushDelay(MULTI_USER_FLUSH_DELAY)
      return this.trigger('remoteop', ...args)
    })
    this._doc.on('flipped_pending_to_inflight', () => {
      this.inflightOpCreatedAt = this.pendingOpCreatedAt
      debugConsole.log('set inflightOpCreatedAt from pendingOpCreatedAt')
      this.pendingOpCreatedAt = null
      debugConsole.log('unset pendingOpCreatedAt')
      return this.trigger('flipped_pending_to_inflight')
    })
    this._doc.on('saved', () => {
      return this.trigger('saved')
    })
    this._doc.on('error', (e: Error) => {
      return this.handleError(e)
    })

    this.bindToDocChanges(this._doc)

    this.processUpdateFromServer({
      open: true,
      v: version,
      snapshot,
    })
    this.removeCarriageReturnCharFromShareJsDoc()
  }

  setTrackChangesUserId(userId: string | null) {
    this.track_changes = userId != null
  }

  getTrackedChanges() {
    if (this._doc.otType === 'history-ot') {
      return this._doc.snapshot.getTrackedChanges() as TrackedChangeList
    } else {
      return null
    }
  }

  private removeCarriageReturnCharFromShareJsDoc() {
    const doc = this._doc
    let nextPos
    while ((nextPos = doc.getText().indexOf('\r')) !== -1) {
      debugConsole.log('[ShareJsDoc] remove-carriage-return-char', nextPos)
      doc.del(nextPos, 1)
    }
  }

  submitOp(op: ShareJsOperation) {
    this._doc.submitOp(op)
  }

  // The following code puts out of order messages into a queue
  // so that they can be processed in order.  This is a workaround
  // for messages being delayed by redis cluster.
  // FIXME: REMOVE THIS WHEN REDIS PUBSUB IS SENDING MESSAGES IN ORDER
  private isAheadOfExpectedVersion(message: Message) {
    return this._doc.version > 0 && message.v > this._doc.version
  }

  private pushOntoQueue(message: Message) {
    debugConsole.log(`[processUpdate] push onto queue ${message.v}`)
    // set a timer so that we never leave messages in the queue indefinitely
    if (!this.queuedMessageTimer) {
      this.queuedMessageTimer = window.setTimeout(() => {
        debugConsole.log(`[processUpdate] queue timeout fired for ${message.v}`)
        // force the message to be processed after the timeout,
        // it will cause an error if the missing update has not arrived
        this.processUpdateFromServer(message)
      }, INFLIGHT_OP_TIMEOUT)
    }
    this.queuedMessages.push(message)
    // keep the queue in order, lowest version first
    this.queuedMessages.sort(function (a, b) {
      return a.v - b.v
    })
  }

  private clearQueue() {
    this.queuedMessages = []
  }

  private processQueue() {
    if (this.queuedMessages.length > 0) {
      const nextAvailableVersion = this.queuedMessages[0].v
      if (nextAvailableVersion > this._doc.version) {
        // there are updates we still can't apply yet
      } else {
        // there's a version we can accept on the queue, apply it
        debugConsole.log(
          `[processUpdate] taken from queue ${nextAvailableVersion}`
        )
        const message = this.queuedMessages.shift()
        if (message) {
          this.processUpdateFromServerInOrder(message)
        }
        // clear the pending timer if the queue has now been cleared
        if (this.queuedMessages.length === 0 && this.queuedMessageTimer) {
          debugConsole.log('[processUpdate] queue is empty, cleared timeout')
          window.clearTimeout(this.queuedMessageTimer)
          this.queuedMessageTimer = null
        }
      }
    }
  }

  // FIXME: This is the new method which reorders incoming updates if needed
  // called from document.ts
  processUpdateFromServerInOrder(message: Message) {
    // Is this update ahead of the next expected update?
    // If so, put it on a queue to be handled later.
    if (this.isAheadOfExpectedVersion(message)) {
      this.pushOntoQueue(message)
      return // defer processing this update for now
    }
    const error = this.processUpdateFromServer(message)
    if (
      error instanceof Error &&
      error.message === 'Invalid version from server'
    ) {
      // if there was an error, abandon the queued updates ahead of this one
      this.clearQueue()
      return
    }
    // Do we have any messages queued up?
    // find the next message if available
    this.processQueue()
  }

  // FIXME: This is the original method. Switch back to this when redis
  // issues are resolved.
  processUpdateFromServer(message: Message) {
    try {
      if (this.type === 'history-ot' && message.op != null) {
        const shareDoc = this._doc as HistoryOTShareDoc
        const trackedChangesBefore = shareDoc.snapshot.getTrackedChanges()
        const commentsBefore = shareDoc.snapshot.getComments()

        const ops = message.op as RawEditOperation[]
        this._doc._onMessage({
          ...message,
          op: ops.map(EditOperationBuilder.fromJSON),
        })

        if (
          this.rangesUpdated(
            trackedChangesBefore,
            commentsBefore,
            shareDoc.snapshot.getTrackedChanges(),
            shareDoc.snapshot.getComments()
          )
        ) {
          this.trigger('ranges:dirty')
        }
      } else {
        this._doc._onMessage(message)
      }
    } catch (error) {
      // Version mismatches are thrown as errors
      debugConsole.log(error)
      this.handleError(error)
      return error // return the error for queue handling
    }

    if (message.meta?.type === 'external') {
      return this.trigger('externalUpdate', message)
    }
  }

  catchUp(updates: Message[]) {
    return updates.map(update => {
      update.v = this._doc.version
      update.doc = this.doc_id
      return this.processUpdateFromServer(update)
    })
  }

  getSnapshot() {
    return this._doc.getText() as string
  }

  getVersion() {
    return this._doc.version
  }

  getTimeSinceLastServerActivity() {
    return Math.floor(performance.now() - this._doc.lastServerActivity)
  }

  getType() {
    return this.type
  }

  clearInflightAndPendingOps() {
    this.clearFatalTimeoutTimer()
    this._doc.inflightOp = null
    this._doc.inflightCallbacks = []
    this._doc.pendingOp = null
    return (this._doc.pendingCallbacks = [])
  }

  flushPendingOps() {
    // This will flush any ops that are pending.
    // If there is an inflight op it will do nothing.
    return this._doc.flush()
  }

  updateConnectionState(state: ShareJsConnectionState) {
    debugConsole.log(`[updateConnectionState] Setting state to ${state}`)
    this.connection.state = state
    this.connection.id = this.socket.publicId
    this._doc.autoOpen = false
    this._doc._connectionStateChanged(state)
    this.lastAcked = null // reset the last ack time when connection changes
  }

  hasBufferedOps() {
    return this._doc.inflightOp != null || this._doc.pendingOp != null
  }

  getInflightOp() {
    return this._doc.inflightOp
  }

  getPendingOp() {
    return this._doc.pendingOp
  }

  getRecentAck() {
    // check if we have received an ack recently (within a factor of two of the single user flush delay)
    return (
      this.lastAcked !== null &&
      performance.now() - this.lastAcked < RECENT_ACK_LIMIT
    )
  }

  getInflightOpCreatedAt() {
    return this.inflightOpCreatedAt
  }

  getPendingOpCreatedAt() {
    return this.pendingOpCreatedAt
  }

  private attachEditorWatchdogManager(editor: EditorFacade) {
    // end-to-end check for edits -> acks, for this very ShareJsdoc
    // This will catch a broken connection and missing UX-blocker for the
    //  user, allowing them to keep editing.
    this.detachEditorWatchdogManager =
      this.editorWatchdogManager.attachToEditor(editor)
  }

  private attachToEditor(editor: EditorFacade, attachToShareJs: () => void) {
    this.attachEditorWatchdogManager(editor)

    attachToShareJs()
  }

  private maybeDetachEditorWatchdogManager() {
    // a failed attach attempt may lead to a missing cleanup handler
    if (this.detachEditorWatchdogManager) {
      this.detachEditorWatchdogManager()
      this.detachEditorWatchdogManager = null
    }
  }

  attachToCM6(cm6: EditorFacade) {
    this.attachToEditor(cm6, () => {
      cm6.attachShareJs(this._doc, getMeta('ol-maxDocLength'))
    })
  }

  detachFromCM6() {
    this.maybeDetachEditorWatchdogManager()
    if (this._doc.detach_cm6) {
      this._doc.detach_cm6()
    }
  }

  private startInflightOpTimeout(update: Update) {
    this.startFatalTimeoutTimer(update)
    const retryOp = () => {
      // Only send the update again if inflightOp is still populated
      // This can be cleared when hard reloading the document in which
      // case we don't want to keep trying to send it.
      debugConsole.log('[inflightOpTimeout] Trying op again')
      if (this._doc.inflightOp != null) {
        // When there is a socket.io disconnect, @_doc.inflightSubmittedIds
        // is updated with the socket.io client id of the current op in flight
        // (meta.source of the op).
        // @connection.id is the client id of the current socket.io session.
        // So we need both depending on whether the op was submitted before
        // one or more disconnects, or if it was submitted during the current session.
        update.dupIfSource = [
          this.connection.id,
          ...Array.from(this._doc.inflightSubmittedIds),
        ]

        // We must be joined to a project for applyOtUpdate to work on the real-time
        // service, so don't send an op if we're not. Connection state is set to 'ok'
        // when we've joined the project
        if (this.connection.state !== 'ok') {
          debugConsole.log(
            '[inflightOpTimeout] Not connected, retrying in 0.5s'
          )
          window.setTimeout(retryOp, WAIT_FOR_CONNECTION_TIMEOUT)
        } else {
          debugConsole.log('[inflightOpTimeout] Sending')
          return this.connection.send(update)
        }
      }
    }

    const timer = window.setTimeout(retryOp, INFLIGHT_OP_TIMEOUT)
    return this._doc.inflightCallbacks.push(() => {
      this.clearFatalTimeoutTimer()
      window.clearTimeout(timer)
    }) // 30 seconds
  }

  private startFatalTimeoutTimer(update: Update) {
    // If an op doesn't get acked within FATAL_OP_TIMEOUT, something has
    // gone unrecoverably wrong (the op will have been retried multiple times)
    if (this._timeoutTimer != null) {
      return
    }
    return (this._timeoutTimer = window.setTimeout(() => {
      this.clearFatalTimeoutTimer()
      return this.trigger('op:timeout', update)
    }, FATAL_OP_TIMEOUT))
  }

  private clearFatalTimeoutTimer() {
    if (this._timeoutTimer == null) {
      return
    }
    clearTimeout(this._timeoutTimer)
    return (this._timeoutTimer = null)
  }

  private handleError(error: unknown, meta = {}) {
    return this.trigger('error', error, meta)
  }

  // @ts-ignore
  private bindToDocChanges(doc: Doc) {
    const { submitOp } = doc
    doc.submitOp = (op: ShareJsOperation, callback?: () => void) => {
      recordDocumentFirstChangeEvent()
      this.trigger('op:sent', op)
      doc.pendingCallbacks.push(() => {
        return this.trigger('op:acknowledged', op)
      })

      // history-ot: submit the op and detect whether tracked changes or comments have updated
      if (this.type === 'history-ot') {
        const shareDoc = doc as HistoryOTShareDoc
        const trackedChangesBefore = shareDoc.snapshot.getTrackedChanges()
        const commentsBefore = shareDoc.snapshot.getComments()
        const result = submitOp.call(doc, op, callback)

        if (
          this.rangesUpdated(
            trackedChangesBefore,
            commentsBefore,
            shareDoc.snapshot.getTrackedChanges(),
            shareDoc.snapshot.getComments()
          )
        ) {
          this.trigger('ranges:dirty')
        }

        return result
      }

      // non-history-ot: just submit the op
      return submitOp.call(doc, op, callback)
    }

    const { flush } = doc
    doc.flush = () => {
      this.trigger('flush', doc.inflightOp, doc.pendingOp, doc.version)
      return flush.call(doc)
    }
  }

  private rangesUpdated(
    trackedChangesBefore: TrackedChangeList,
    commentsBefore: CommentList,
    trackedChangesAfter: TrackedChangeList,
    commentsAfter: CommentList
  ) {
    return (
      // quick length comparison first
      trackedChangesBefore.length !== trackedChangesAfter.length ||
      commentsBefore.length !== commentsAfter.length ||
      // then compare each item by identity
      this.itemsChanged(
        trackedChangesBefore.asSorted(),
        trackedChangesAfter.asSorted()
      ) ||
      this.itemsChanged(commentsBefore.toArray(), commentsAfter.toArray())
    )
  }

  private itemsChanged(before: readonly any[], after: readonly any[]) {
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) {
        return true
      }
    }
  }
}
