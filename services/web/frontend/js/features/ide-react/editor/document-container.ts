/* eslint-disable camelcase */
// Migrated from services/web/frontend/js/ide/editor/Document.js

import RangesTracker from '@overleaf/ranges-tracker'
import { OTType, ShareJsDoc } from './share-js-doc'
import { debugConsole } from '@/utils/debugging'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { EditorFacade } from '@/features/source-editor/extensions/realtime'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import EventEmitter from '@/utils/EventEmitter'
import {
  AnyOperation,
  Change,
  CommentOperation,
  EditOperation,
} from '../../../../../types/change'
import {
  isCommentOperation,
  isDeleteOperation,
  isEditOperation,
  isInsertOperation,
} from '@/utils/operations'
import { decodeUtf8 } from '@/utils/decode-utf8'
import {
  ShareJsOperation,
  TrackChangesIdSeeds,
} from '@/features/ide-react/editor/types/document'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import getMeta from '@/utils/meta'
import OError from '@overleaf/o-error'
import {
  HistoryOTShareDoc,
  ShareLatexOTShareDoc,
} from '../../../../../types/share-doc'

const MAX_PENDING_OP_SIZE = 64

type JoinCallback = (error?: Error) => void
type LeaveCallback = JoinCallback

type Update =
  | {
      v: number
      doc: string
    }
  | {
      v: number
      doc: string
      op: AnyOperation[]
      meta: {
        type?: string
        source: string
        user_id: string
        ts: number
      }
      hash?: string
      lastV?: number
    }

type Message = {
  meta: {
    tc: string
    user_id: string
  }
}

type ErrorMetadata = Record<string, any>

function getOpSize(op: AnyOperation) {
  if (isInsertOperation(op)) {
    return op.i.length
  }
  if (isDeleteOperation(op)) {
    return op.d.length
  }
  return 0
}

function getShareJsOpSize(shareJsOp: ShareJsOperation) {
  return shareJsOp.reduce((total, op) => total + getOpSize(op), 0)
}

// TODO: define these in RangesTracker
type _RangesTracker = Omit<RangesTracker, 'changes' | 'comments'> & {
  changes: Change<EditOperation>[]
  comments: Change<CommentOperation>[]
  track_changes?: boolean
}

export type RangesTrackerWithResolvedThreadIds = _RangesTracker & {
  resolvedThreadIds: Record<ThreadId, boolean>
}

export class DocumentContainer extends EventEmitter {
  private connected: boolean
  private wantToBeJoined = false
  private chaosMonkeyTimer: number | null = null
  public track_changes_as: string | null = null

  private joinCallbacks: JoinCallback[] = []
  private leaveCallbacks: LeaveCallback[] = []

  doc?: ShareJsDoc
  cm6?: EditorFacade
  oldInflightOp?: ShareJsOperation

  ranges?: _RangesTracker | RangesTrackerWithResolvedThreadIds

  joined = false

  // This is set and read in useCodeMirrorScope
  docName = ''

  constructor(
    readonly doc_id: string,
    readonly socket: Socket,
    private readonly globalEditorWatchdogManager: EditorWatchdogManager,
    private readonly ideEventEmitter: IdeEventEmitter,
    private readonly detachDoc: (docId: string, doc: DocumentContainer) => void
  ) {
    super()
    this.connected = this.socket.socket.connected
    this.bindToEditorEvents()
    this.bindToSocketEvents()
  }

  get shareDoc() {
    if (!this.doc) {
      throw new Error('Missing ShareJSDoc')
    }
    if (!this.doc._doc) {
      throw new Error('Missing ShareJS Doc')
    }
    return this.doc._doc as HistoryOTShareDoc | ShareLatexOTShareDoc
  }

  isHistoryOT() {
    return this.shareDoc.otType === 'history-ot'
  }

  get historyOTShareDoc() {
    if (!this.isHistoryOT()) {
      throw new Error('shareDoc is not historyOT')
    }
    return this.shareDoc as HistoryOTShareDoc
  }

  attachToCM6(cm6: EditorFacade) {
    this.cm6 = cm6
    if (this.doc) {
      this.doc.attachToCM6(this.cm6)
    }
    this.cm6.on('change', this.checkConsistency)
  }

  detachFromCM6() {
    if (this.doc) {
      this.doc.detachFromCM6()
    }
    if (this.cm6) {
      this.cm6.off('change', this.checkConsistency)
    }
    delete this.cm6
    this.clearChaosMonkey()
    if (this.doc) {
      this.ideEventEmitter.emit('document:closed', this.doc)
    }
  }

  submitOp(...ops: AnyOperation[]) {
    this.doc?.submitOp(ops)
  }

  private checkConsistency = (editor: EditorFacade) => {
    // We've been seeing a lot of errors when I think there shouldn't be
    // any, which may be related to this check happening before the change is
    // applied. If we use a timeout, hopefully we can reduce this.
    window.setTimeout(() => {
      const editorValue = editor?.getValue()
      const sharejsValue = this.doc?.getSnapshot()
      if (editorValue !== sharejsValue) {
        return this.onError(
          new Error('Editor text does not match server text'),
          {},
          editorValue
        )
      }
    }, 0)
  }

  getSnapshot() {
    return this.doc?.getSnapshot()
  }

  getType() {
    return this.doc?.getType()
  }

  getInflightOp(): ShareJsOperation | undefined {
    return this.doc?.getInflightOp()
  }

  getPendingOp(): ShareJsOperation | undefined {
    return this.doc?.getPendingOp()
  }

  getRecentAck() {
    return this.doc?.getRecentAck()
  }

  getInflightOpCreatedAt() {
    return this.doc?.getInflightOpCreatedAt()
  }

  getPendingOpCreatedAt() {
    return this.doc?.getPendingOpCreatedAt()
  }

  hasBufferedOps() {
    return this.doc?.hasBufferedOps()
  }

  setTrackChangesUserId(userId: string | null) {
    this.track_changes_as = userId
    if (this.doc) {
      this.doc.setTrackChangesUserId(userId)
    }
    if (this.cm6) {
      this.cm6.setTrackChangesUserId(userId)
    }
  }

  getTrackingChanges() {
    return !!this.doc?.track_changes
  }

  setTrackChangesIdSeeds(id_seeds: TrackChangesIdSeeds) {
    if (this.doc) {
      this.doc.track_changes_id_seeds = id_seeds
    }
  }

  private onUpdateAppliedHandler = (update: any) => this.onUpdateApplied(update)

  private onErrorHandler = (error: Error, message: ErrorMetadata) => {
    // 'otUpdateError' are emitted per doc socket.io room, hence we can be
    //  sure that message.doc_id exists.
    if (message.doc_id !== this.doc_id) {
      // This error is for another doc. Do not action it. We could open
      //  a modal that has the wrong context on it.
      return
    }
    this.onError(error, message)
  }

  private onDisconnectHandler = () => this.onDisconnect()

  private bindToSocketEvents() {
    this.socket.on('otUpdateApplied', this.onUpdateAppliedHandler)
    this.socket.on('otUpdateError', this.onErrorHandler)
    return this.socket.on('disconnect', this.onDisconnectHandler)
  }

  private unBindFromSocketEvents() {
    this.socket.removeListener('otUpdateApplied', this.onUpdateAppliedHandler)
    this.socket.removeListener('otUpdateError', this.onErrorHandler)
    return this.socket.removeListener('disconnect', this.onDisconnectHandler)
  }

  private bindToEditorEvents() {
    this.ideEventEmitter.on('project:joined', this.onReconnect)
  }

  private unBindFromEditorEvents() {
    this.ideEventEmitter.off('project:joined', this.onReconnect)
  }

  leaveAndCleanUp(cb?: (error?: Error) => void) {
    return this.leave((error?: Error) => {
      this.cleanUp()
      if (cb) cb(error)
    })
  }

  leaveAndCleanUpPromise() {
    return new Promise<void>((resolve, reject) => {
      this.leaveAndCleanUp((error?: Error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  join(callback?: JoinCallback) {
    this.wantToBeJoined = true
    this.cancelLeave()
    if (this.connected) {
      this.joinDoc(callback)
    } else if (callback) {
      this.joinCallbacks.push(callback)
    }
  }

  leave(callback?: LeaveCallback) {
    this.flush() // force an immediate flush when leaving document
    this.wantToBeJoined = false
    this.cancelJoin()
    if (this.doc?.hasBufferedOps()) {
      debugConsole.log(
        '[leave] Doc has buffered ops, pushing callback for later'
      )
      if (callback) {
        this.leaveCallbacks.push(callback)
      }
    } else if (!this.connected) {
      debugConsole.log('[leave] Not connected, returning now')
      callback?.()
    } else {
      debugConsole.log('[leave] Leaving now')
      this.leaveDoc(callback)
    }
  }

  flush() {
    return this.doc?.flushPendingOps()
  }

  chaosMonkey(line = 0, char = 'a') {
    const orig = char
    let copy: string | null = null
    let pos = 0
    const timer = () => {
      if (copy == null || !copy.length) {
        copy = orig.slice() + ' ' + new Date() + '\n'
        line += Math.random() > 0.1 ? 1 : -2
        if (line < 0) {
          line = 0
        }
        pos = 0
      }
      char = copy[0]
      copy = copy.slice(1)
      if (this.cm6) {
        this.cm6.view.dispatch({
          changes: {
            from: Math.min(pos, this.cm6.view.state.doc.length),
            insert: char,
          },
        })
      }
      pos += 1
      this.chaosMonkeyTimer = window.setTimeout(
        timer,
        100 + (Math.random() < 0.1 ? 1000 : 0)
      )
    }
    timer()
  }

  clearChaosMonkey() {
    const timer = this.chaosMonkeyTimer
    if (timer) {
      this.chaosMonkeyTimer = null
      window.clearTimeout(timer)
    }
  }

  pollSavedStatus() {
    // returns false if doc has ops waiting to be acknowledged or
    // sent that haven't changed since the last time we checked.
    // Otherwise returns true.
    let saved
    const inflightOp = this.getInflightOp()
    const pendingOp = this.getPendingOp()
    const recentAck = this.getRecentAck()
    const pendingOpSize = pendingOp ? getShareJsOpSize(pendingOp) : 0
    if (inflightOp == null && pendingOp == null) {
      // There's nothing going on, this is OK.
      saved = true
      debugConsole.log('[pollSavedStatus] no inflight or pending ops')
    } else if (inflightOp && inflightOp === this.oldInflightOp) {
      // The same inflight op has been sitting unacked since we
      // last checked, this is bad.
      saved = false
      debugConsole.log('[pollSavedStatus] inflight op is same as before')
    } else if (
      pendingOp != null &&
      recentAck &&
      pendingOpSize < MAX_PENDING_OP_SIZE
    ) {
      // There is an op waiting to go to server but it is small and
      // within the recent ack limit, this is OK for now.
      saved = true
      debugConsole.log(
        '[pollSavedStatus] pending op (small with recent ack) assume ok',
        pendingOp,
        pendingOpSize
      )
    } else {
      // In any other situation, assume the document is unsaved.
      saved = false
      debugConsole.log(
        `[pollSavedStatus] assuming not saved (inflightOp?: ${
          inflightOp != null
        }, pendingOp?: ${pendingOp != null})`
      )
    }

    this.oldInflightOp = inflightOp
    return saved
  }

  private cancelLeave() {
    this.leaveCallbacks = []
  }

  private cancelJoin() {
    this.joinCallbacks = []
  }

  private onUpdateApplied(update: Update) {
    if (update?.doc === this.doc_id && this.doc != null) {
      // FIXME: change this back to processUpdateFromServer when redis fixed
      this.doc.processUpdateFromServerInOrder(update)

      if (!this.wantToBeJoined) {
        return this.leave()
      }
    }
  }

  private onDisconnect() {
    debugConsole.log('[onDisconnect] disconnecting')
    this.connected = false
    this.joined = false
    return this.doc != null
      ? this.doc.updateConnectionState('disconnected')
      : undefined
  }

  private onReconnect = () => {
    debugConsole.log('[onReconnect] reconnected (joined project)')

    this.connected = true
    if (this.wantToBeJoined || this.doc?.hasBufferedOps()) {
      debugConsole.log(
        `[onReconnect] Rejoining (wantToBeJoined: ${
          this.wantToBeJoined
        } OR hasBufferedOps: ${this.doc?.hasBufferedOps()})`
      )
      this.joinDoc((error?: Error) => {
        if (error) {
          this.onError(error)
          return
        }
        this.doc?.updateConnectionState('ok')
        this.doc?.flushPendingOps()
        this.callJoinCallbacks()
      })
    }
  }

  private callJoinCallbacks() {
    for (const callback of this.joinCallbacks) {
      callback()
    }
    this.joinCallbacks = []
  }

  private joinDoc(callback?: JoinCallback) {
    if (this.doc) {
      return this.socket.emit(
        'joinDoc',
        this.doc_id,
        this.doc.getVersion(),
        {
          encodeRanges: true,
          age: this.doc.getTimeSinceLastServerActivity(),
          supportsHistoryOT: true,
        },
        (
          error,
          docLines,
          version,
          updates,
          ranges,
          type = 'sharejs-text-ot'
        ) => {
          if (error) {
            callback?.(error)
            return
          }
          this.joined = true
          this.doc?.catchUp(updates)
          if (this.doc?.getType() !== type) {
            // TODO(24596): page reload after checking for pending ops?
            throw new OError('ot type mismatch', {
              got: type,
              want: this.doc?.getType(),
            })
          }
          if (type === 'sharejs-text-ot') {
            this.decodeRanges(ranges)
            this.catchUpRanges(ranges?.changes, ranges?.comments)
          }
          callback?.()
        }
      )
    } else {
      this.socket.emit(
        'joinDoc',
        this.doc_id,
        {
          encodeRanges: true,
          supportsHistoryOT: true,
        },
        (
          error,
          docLines,
          version,
          updates,
          ranges,
          type: OTType = 'sharejs-text-ot'
        ) => {
          if (error) {
            callback?.(error)
            return
          }
          this.joined = true
          this.doc = new ShareJsDoc(
            this.doc_id,
            docLines,
            version,
            this.socket,
            this.globalEditorWatchdogManager,
            this.ideEventEmitter,
            type
          )
          if (type === 'sharejs-text-ot') {
            this.decodeRanges(ranges)
          }
          this.ranges = new RangesTracker(ranges?.changes, ranges?.comments)
          this.bindToShareJsDocEvents()
          callback?.()
        }
      )
    }
  }

  private decodeRanges(ranges: RangesTracker) {
    try {
      if (ranges.changes) {
        for (const change of ranges.changes) {
          if (isInsertOperation(change.op)) {
            change.op.i = decodeUtf8(change.op.i)
          }
          if (isDeleteOperation(change.op)) {
            change.op.d = decodeUtf8(change.op.d)
          }
        }
      }
      return (() => {
        if (!ranges.comments) {
          return []
        }
        return ranges.comments.map((comment: Change<CommentOperation>) =>
          comment.op.c != null
            ? (comment.op.c = decodeUtf8(comment.op.c))
            : undefined
        )
      })()
    } catch (err) {
      debugConsole.error(err)
    }
  }

  private leaveDoc(callback?: LeaveCallback) {
    debugConsole.log('[leaveDoc] Sending leaveDoc request')
    this.socket.emit('leaveDoc', this.doc_id, error => {
      if (error) {
        callback?.(error)
        return
      }
      this.joined = false
      for (const leaveCallback of this.leaveCallbacks) {
        debugConsole.log('[_leaveDoc] Calling buffered callback', leaveCallback)
        leaveCallback(error)
      }
      this.leaveCallbacks = []
      callback?.()
    })
  }

  cleanUp() {
    // if we arrive here from _onError the pending and inflight ops will have been cleared
    if (this.hasBufferedOps()) {
      debugConsole.log(
        `[cleanUp] Document (${this.doc_id}) has buffered ops, refusing to remove from openDocs`
      )
      return // return immediately, do not unbind from events
    }

    this.detachDoc(this.doc_id, this)

    this.unBindFromEditorEvents()
    this.unBindFromSocketEvents()
  }

  private bindToShareJsDocEvents() {
    if (!this.doc) {
      return
    }

    this.doc.on('error', (error: Error, meta: ErrorMetadata) =>
      this.onError(error, meta)
    )
    this.doc.on('externalUpdate', (update: Update) => {
      return this.trigger('externalUpdate', update)
    })
    this.doc.on('remoteop', (...ops: AnyOperation[]) => {
      return this.trigger('remoteop', ...ops)
    })
    this.doc.on('op:sent', () => {
      return this.trigger('op:sent')
    })
    this.doc.on('op:acknowledged', (op: AnyOperation) => {
      this.ideEventEmitter.emit('ide:opAcknowledged', {
        doc_id: this.doc_id,
        op,
      })
      return this.trigger('op:acknowledged')
    })
    this.doc.on('op:timeout', () => {
      this.trigger('op:timeout')
      return this.onError(new Error('op timed out'))
    })
    this.doc.on('ranges:dirty', (...args) => {
      return this.trigger('ranges:dirty', ...args)
    })

    let docChangedTimeout: number | null = null
    this.doc.on(
      'change',
      (ops: AnyOperation[], oldSnapshot: any, msg: Message) => {
        if (this.getType() === 'sharejs-text-ot') {
          this.applyOpsToRanges(ops, msg)
        }
        if (docChangedTimeout) {
          window.clearTimeout(docChangedTimeout)
        }
        docChangedTimeout = window.setTimeout(() => {
          if (ops.some(isEditOperation)) {
            window.dispatchEvent(
              new CustomEvent('doc:changed', { detail: { id: this.doc_id } })
            )
            this.ideEventEmitter.emit('doc:changed', {
              doc_id: this.doc_id,
            })
          }
        }, 50)
      }
    )

    this.doc.on('flipped_pending_to_inflight', () => {
      return this.trigger('flipped_pending_to_inflight')
    })

    let docSavedTimeout: number | null
    this.doc.on('saved', () => {
      if (docSavedTimeout) {
        window.clearTimeout(docSavedTimeout)
      }
      docSavedTimeout = window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('doc:saved', { detail: { id: this.doc_id } })
        )
        this.ideEventEmitter.emit('doc:saved', { doc_id: this.doc_id })
      }, 50)
    })
  }

  private onError(
    error: Error,
    meta: ErrorMetadata = {},
    editorContent?: string
  ) {
    meta.doc_id = this.doc_id
    debugConsole.log('ShareJS error', error, meta)
    if (error.message === 'no project_id found on client') {
      debugConsole.log('ignoring error, will wait to join project')
      return
    }
    if (this.doc) {
      this.doc.clearInflightAndPendingOps()
    }
    this.trigger('error', error, meta, editorContent)
    // The clean-up should run after the error is triggered because the error triggers a
    // disconnect. If we run the clean-up first, we remove our event handlers and miss
    // the disconnect event, which means we try to leaveDoc when the connection comes back.
    // This could interfere with the new connection of a new instance of this document.
    this.cleanUp()
  }

  private applyOpsToRanges(ops: AnyOperation[], msg?: Message) {
    let old_id_seed
    let track_changes_as = null
    const remote_op = msg != null
    if (remote_op && msg?.meta.tc) {
      old_id_seed = this.ranges!.getIdSeed()
      this.ranges!.setIdSeed(msg.meta.tc)
      track_changes_as = msg.meta.user_id
    } else if (!remote_op && this.track_changes_as != null) {
      track_changes_as = this.track_changes_as
    }
    this.ranges!.track_changes = track_changes_as != null
    for (const op of this.filterOps(ops)) {
      this.ranges!.applyOp(op, { user_id: track_changes_as })
    }
    if (old_id_seed != null) {
      this.ranges!.setIdSeed(old_id_seed)
    }
    if (remote_op) {
      // With remote ops, the editor hasn't been updated when we receive this
      // op, so defer updating track changes until it has
      return window.setTimeout(() => this.emit('ranges:dirty'))
    } else {
      return this.emit('ranges:dirty')
    }
  }

  private catchUpRanges(
    changes: Change<EditOperation>[],
    comments: Change<CommentOperation>[]
  ) {
    // We've just been given the current server's ranges, but need to apply any local ops we have.
    // Reset to the server state then apply our local ops again.
    if (changes == null) {
      changes = []
    }
    if (comments == null) {
      comments = []
    }
    this.emit('ranges:clear')
    this.ranges!.changes = changes
    this.ranges!.comments = comments
    this.ranges!.track_changes = this.doc?.track_changes ?? false
    for (const op of this.filterOps(this.doc?.getInflightOp() || [])) {
      this.ranges!.setIdSeed(this.doc?.track_changes_id_seeds?.inflight)
      this.ranges!.applyOp(op, { user_id: this.track_changes_as })
    }
    for (const op of this.filterOps(this.doc?.getPendingOp() || [])) {
      this.ranges!.setIdSeed(this.doc?.track_changes_id_seeds?.pending)
      this.ranges!.applyOp(op, { user_id: this.track_changes_as })
    }
    return this.emit('ranges:redraw')
  }

  private filterOps(ops: AnyOperation[]) {
    // Read-only token users can't see/edit comment, so we filter out comment
    // ops to avoid highlighting comment ranges.
    if (getMeta('ol-isRestrictedTokenMember')) {
      return ops.filter(op => !isCommentOperation(op))
    } else {
      return ops
    }
  }
}
