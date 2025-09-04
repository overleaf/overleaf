import {
  Prec,
  Transaction,
  Annotation,
  ChangeSpec,
  Text,
  StateEffect,
} from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { EventEmitter } from 'events'
import RangesTracker from '@overleaf/ranges-tracker'
import {
  ShareDoc,
  ShareLatexOTShareDoc,
  HistoryOTShareDoc,
} from '../../../../../types/share-doc'
import { debugConsole } from '@/utils/debugging'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import {
  EditOperation,
  TextOperation,
  InsertOp,
  RemoveOp,
  RetainOp,
} from 'overleaf-editor-core'
import { rangesUpdatedEffect, setTrackChangesUserId } from './history-ot'
import { trackedDeletesFromState } from '@/features/source-editor/utils/tracked-deletes'

/*
 * Integrate CodeMirror 6 with the real-time system, via ShareJS.
 *
 * Changes from CodeMirror are passed to the shareDoc
 * via `handleTransaction`, while changes arriving from
 * real-time are passed to CodeMirror via the EditorFacade.
 *
 * We use an `EditorFacade` to integrate with the rest of
 * the IDE, providing an interface the other systems can work with.
 *
 * Related files:
 *   - frontend/js/ide/editor/Document.js
 *   - frontend/js/ide/editor/ShareJsDoc.js
 *   - frontend/js/ide/connection/EditorWatchdogManager.js
 *   - frontend/js/features/ide-react/editor/document.ts
 *   - frontend/js/features/ide-react/editor/share-js-doc.ts
 *   - frontend/js/features/ide-react/connection/editor-watchdog-manager.js
 */

type Origin = 'remote' | 'undo' | 'reject' | undefined

export type ChangeDescription = {
  origin: Origin
  inserted: boolean
  removed: boolean
}

/**
 * A custom extension that connects the CodeMirror 6 editor to the currently open ShareJS document.
 */
export const realtime = (
  { currentDoc }: { currentDoc: DocumentContainer },
  handleError: (error: Error) => void
) => {
  const realtimePlugin = ViewPlugin.define(view => {
    const editor = new EditorFacade(view)

    currentDoc.attachToCM6(editor)

    return {
      update(update) {
        if (update.docChanged) {
          editor.handleUpdateFromCM(update.transactions, currentDoc.ranges)
        }
      },
      destroy() {
        // TODO: wrap in a timeout so processing can finish?
        // window.setTimeout(() => {
        currentDoc.detachFromCM6()
        // }, 0)
      },
    }
  })

  // NOTE: not a view plugin, so shouldn't get removed
  const ensureRealtimePlugin = EditorView.updateListener.of(update => {
    if (!update.view.plugin(realtimePlugin)) {
      const message = 'The realtime extension has been destroyed!!'
      debugConsole.warn(message)
      if (currentDoc.doc) {
        // display the "out of sync" modal
        currentDoc.doc.emit('error', message)
      } else {
        // display the error boundary
        handleError(new Error(message))
      }
    }
  })

  return Prec.highest([realtimePlugin, ensureRealtimePlugin])
}

type OTAdapter = {
  handleUpdateFromCM(
    transactions: readonly Transaction[],
    ranges?: RangesTracker
  ): void
  attachShareJs(): void
}

export class EditorFacade extends EventEmitter {
  private otAdapter: OTAdapter | null
  public events: EventEmitter

  constructor(public view: EditorView) {
    super()
    this.view = view
    this.otAdapter = null
    this.events = new EventEmitter()
  }

  getValue() {
    return this.view.state.doc.toString()
  }

  // Dispatch changes to CodeMirror view
  cmChange(changes: ChangeSpec, origin?: string) {
    const isRemote = origin === 'remote'

    this.view.dispatch({
      changes,
      annotations: [
        Transaction.remote.of(isRemote),
        Transaction.addToHistory.of(!isRemote),
      ],
      effects:
        // if this is a remote change, restore a snapshot of the current scroll position after the change has been applied
        isRemote
          ? this.view.scrollSnapshot().map(this.view.state.changes(changes))
          : undefined,
    })
  }

  cmInsert(position: number, text: string, origin?: string) {
    this.cmChange({ from: position, insert: text }, origin)
  }

  cmDelete(position: number, text: string, origin?: string) {
    this.cmChange({ from: position, to: position + text.length }, origin)
  }

  attachShareJs(shareDoc: ShareDoc, maxDocLength?: number) {
    this.otAdapter =
      shareDoc.otType === 'history-ot'
        ? new HistoryOTAdapter(this, shareDoc, maxDocLength)
        : new ShareLatexOTAdapter(this, shareDoc, maxDocLength)
    this.otAdapter.attachShareJs()
  }

  detachShareJs() {
    this.otAdapter = null
  }

  handleUpdateFromCM(
    transactions: readonly Transaction[],
    ranges?: RangesTracker
  ) {
    if (this.otAdapter == null) {
      throw new Error('Trying to process updates with no otAdapter')
    }

    this.otAdapter.handleUpdateFromCM(transactions, ranges)
  }

  setTrackChangesUserId(userId: string | null) {
    if (this.otAdapter instanceof HistoryOTAdapter) {
      this.view.dispatch(setTrackChangesUserId(userId))
    }
  }
}

class ShareLatexOTAdapter {
  constructor(
    public editor: EditorFacade,
    private shareDoc: ShareLatexOTShareDoc,
    private maxDocLength?: number
  ) {
    this.editor = editor
    this.shareDoc = shareDoc
    this.maxDocLength = maxDocLength
  }

  // Connect to ShareJS, passing changes to the CodeMirror view
  // as new transactions.
  // This is a broad immitation of helper functions supplied in
  // the sharejs library. (See vendor/libs/sharejs, in particular
  // the 'attach_ace' helper)
  attachShareJs() {
    const shareDoc = this.shareDoc
    const check = () => {
      // run in a timeout so it checks the editor content once this update has been applied
      window.setTimeout(() => {
        const editorText = this.editor.getValue()
        const otText = shareDoc.getText()

        if (editorText !== otText) {
          this.shareDoc.emit('error', 'Text does not match in CodeMirror 6')
          debugConsole.error('Text does not match!')
          debugConsole.error('editor: ' + editorText)
          debugConsole.error('ot:     ' + otText)
        }
      }, 0)
    }

    const onInsert = (pos: number, text: string) => {
      this.editor.cmInsert(pos, text, 'remote')
      check()
    }

    const onDelete = (pos: number, text: string) => {
      this.editor.cmDelete(pos, text, 'remote')
      check()
    }

    check()

    shareDoc.on('insert', onInsert)
    shareDoc.on('delete', onDelete)

    shareDoc.detach_cm6 = () => {
      shareDoc.removeListener('insert', onInsert)
      shareDoc.removeListener('delete', onDelete)
      delete shareDoc.detach_cm6
      this.editor.detachShareJs()
    }
  }

  // Process an update from CodeMirror, applying changes to the
  // ShareJs doc if appropriate
  handleUpdateFromCM(
    transactions: readonly Transaction[],
    ranges?: RangesTracker
  ) {
    const shareDoc = this.shareDoc
    const trackedDeletesLength =
      ranges != null ? ranges.getTrackedDeletesLength() : 0

    for (const transaction of transactions) {
      if (transaction.docChanged) {
        const origin = chooseOrigin(transaction)

        if (origin === 'remote') {
          return
        }

        // This is an approximation. Some deletes could have generated new
        // tracked deletes since we measured trackedDeletesLength at the top of
        // the function. Unfortunately, the ranges tracker is only updated
        // after all transactions are processed, so it's not easy to get an
        // exact number.
        const fullDocLength =
          transaction.changes.desc.newLength + trackedDeletesLength

        if (this.maxDocLength && fullDocLength >= this.maxDocLength) {
          shareDoc.emit(
            'error',
            new Error('document length is greater than maxDocLength')
          )
          return
        }

        let positionShift = 0

        transaction.changes.iterChanges(
          (fromA, toA, fromB, toB, insertedText) => {
            const fromUndo = origin === 'undo' || origin === 'reject'

            const insertedLength = insertedText.length
            const removedLength = toA - fromA

            const inserted = insertedLength > 0
            const removed = removedLength > 0

            const pos = fromA + positionShift

            if (removed) {
              shareDoc.del(pos, removedLength, fromUndo)
            }

            if (inserted) {
              shareDoc.insert(pos, insertedText.toString(), fromUndo)
            }

            // TODO: mapPos instead?
            positionShift = positionShift - removedLength + insertedLength

            const changeDescription: ChangeDescription = {
              origin,
              inserted,
              removed,
            }

            this.editor.emit('change', this.editor, changeDescription)
          }
        )
      }
    }
  }
}

class HistoryOTAdapter {
  constructor(
    public editor: EditorFacade,
    private shareDoc: HistoryOTShareDoc,
    private maxDocLength?: number
  ) {
    this.editor = editor
    this.shareDoc = shareDoc
    this.maxDocLength = maxDocLength
  }

  attachShareJs() {
    this.checkContent()

    const onRemoteOp = this.onRemoteOp.bind(this)
    this.shareDoc.on('remoteop', onRemoteOp)

    this.shareDoc.detach_cm6 = () => {
      this.shareDoc.removeListener('remoteop', onRemoteOp)
      delete this.shareDoc.detach_cm6
      this.editor.detachShareJs()
    }
  }

  handleUpdateFromCM(transactions: readonly Transaction[]) {
    for (const transaction of transactions) {
      if (
        this.maxDocLength &&
        transaction.changes.newLength >= this.maxDocLength
      ) {
        this.shareDoc.emit(
          'error',
          new Error('document length is greater than maxDocLength')
        )
        return
      }

      const origin = chooseOrigin(transaction)
      transaction.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        this.onCodeMirrorChange(fromA, toA, fromB, toB, inserted, origin)
      })
    }
  }

  onRemoteOp(operations: EditOperation[]) {
    const trackedDeletes = trackedDeletesFromState(this.editor.view.state)
    const changes: ChangeSpec[] = []
    let trackedChangesUpdated = false
    for (const operation of operations) {
      if (operation instanceof TextOperation) {
        let cursor = 0
        for (const op of operation.ops) {
          if (op instanceof InsertOp) {
            if (op.tracking?.type !== 'delete') {
              changes.push({
                from: trackedDeletes.toCodeMirror(cursor),
                insert: op.insertion,
              })
            }
            trackedChangesUpdated = true
          } else if (op instanceof RemoveOp) {
            changes.push({
              from: trackedDeletes.toCodeMirror(cursor),
              to: trackedDeletes.toCodeMirror(cursor + op.length),
            })
            cursor += op.length
            trackedChangesUpdated = true
          } else if (op instanceof RetainOp) {
            if (op.tracking != null) {
              if (op.tracking.type === 'delete') {
                changes.push({
                  from: trackedDeletes.toCodeMirror(cursor),
                  to: trackedDeletes.toCodeMirror(cursor + op.length),
                })
              }
              trackedChangesUpdated = true
            }
            cursor += op.length
          }
        }
      }

      const view = this.editor.view
      const effects: StateEffect<any>[] = []
      const scrollEffect = view
        .scrollSnapshot()
        .map(view.state.changes(changes))
      if (scrollEffect != null) {
        effects.push(scrollEffect)
      }
      if (trackedChangesUpdated) {
        effects.push(rangesUpdatedEffect.of(null))
      }

      view.dispatch({
        changes,
        effects,
        annotations: [
          Transaction.remote.of(true),
          Transaction.addToHistory.of(false),
        ],
      })
    }
  }

  onCodeMirrorChange(
    fromA: number,
    toA: number,
    fromB: number,
    toB: number,
    insertedText: Text,
    origin: Origin
  ) {
    const insertedLength = insertedText.length
    const removedLength = toA - fromA
    const inserted = insertedLength > 0
    const removed = removedLength > 0

    const changeDescription: ChangeDescription = {
      origin,
      inserted,
      removed,
    }

    this.editor.emit('change', this.editor, changeDescription)
  }

  checkContent() {
    // run in a timeout so it checks the editor content once this update has been applied
    window.setTimeout(() => {
      const editorText = this.editor.getValue()
      const otText = this.shareDoc.getText()

      if (editorText !== otText) {
        this.shareDoc.emit('error', 'Text does not match in CodeMirror 6')
        debugConsole.error('Text does not match!')
        debugConsole.error('editor: ' + editorText)
        debugConsole.error('ot:     ' + otText)
      }
    }, 0)
  }
}

export const trackChangesAnnotation = Annotation.define()

const chooseOrigin = (transaction: Transaction) => {
  if (transaction.annotation(Transaction.remote)) {
    return 'remote'
  }
  if (transaction.annotation(Transaction.userEvent) === 'undo') {
    return 'undo'
  }
  if (transaction.annotation(trackChangesAnnotation) === 'reject') {
    return 'reject'
  }
}
