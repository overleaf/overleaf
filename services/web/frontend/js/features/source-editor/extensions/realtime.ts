import { Prec, Transaction, Annotation } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { EventEmitter } from 'events'
import { CurrentDoc } from '../../../../../types/current-doc'
import { ShareDoc } from '../../../../../types/share-doc'

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
 */

export const realtime = (
  { currentDoc }: { currentDoc: CurrentDoc },
  handleError: (error: Error) => void
) => {
  const realtimePlugin = ViewPlugin.define(view => {
    const editor = new EditorFacade(view)

    currentDoc.attachToCM6(editor)

    return {
      update(update) {
        if (update.docChanged) {
          editor.handleUpdateFromCM(update.transactions)
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
      console.log(message)
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

export class EditorFacade extends EventEmitter {
  public shareDoc: ShareDoc | null
  public events: EventEmitter
  private maxDocLength?: number

  constructor(public view: EditorView) {
    super()
    this.view = view
    this.shareDoc = null
    this.events = new EventEmitter()
  }

  getValue() {
    return this.view.state.doc.toString()
  }

  // Dispatch changes to CodeMirror view
  cmInsert(position: number, text: string, origin?: string) {
    this.view.dispatch({
      changes: { from: position, insert: text },
      annotations: [
        Transaction.remote.of(origin === 'remote'),
        Transaction.addToHistory.of(origin !== 'remote'),
      ],
    })
  }

  cmDelete(position: number, text: string, origin?: string) {
    this.view.dispatch({
      changes: { from: position, to: position + text.length },
      annotations: [
        Transaction.remote.of(origin === 'remote'),
        Transaction.addToHistory.of(origin !== 'remote'),
      ],
    })
  }

  // Connect to ShareJS, passing changes to the CodeMirror view
  // as new transactions.
  // This is a broad immitation of helper functions supplied in
  // the sharejs library. (See vendor/libs/sharejs, in particular
  // the 'attach_cm' and 'attach_ace' helpers)
  attachShareJs(shareDoc: ShareDoc, maxDocLength?: number) {
    this.shareDoc = shareDoc
    this.maxDocLength = maxDocLength

    const check = () => {
      // run in a timeout so it checks the editor content once this update has been applied
      window.setTimeout(() => {
        const editorText = this.getValue()
        const otText = shareDoc.getText()

        if (editorText !== otText) {
          shareDoc.emit('error', 'Text does not match in CodeMirror 6')
          console.error('Text does not match!')
          console.error('editor: ' + editorText)
          return console.error('ot:     ' + otText)
        }
      }, 0)
    }

    const onInsert = (pos: number, text: string) => {
      this.cmInsert(pos, text, 'remote')
      check()
    }

    const onDelete = (pos: number, text: string) => {
      this.cmDelete(pos, text, 'remote')
      check()
    }

    check()

    shareDoc.on('insert', onInsert)
    shareDoc.on('delete', onDelete)

    shareDoc.detach_cm6 = () => {
      shareDoc.removeListener('insert', onInsert)
      shareDoc.removeListener('delete', onDelete)
      delete shareDoc.detach_cm6
      this.shareDoc = null
    }
  }

  // Process an update from CodeMirror, applying changes to the
  // ShareJs doc if appropriate
  handleUpdateFromCM(transactions: readonly Transaction[]) {
    const shareDoc = this.shareDoc

    if (!shareDoc) {
      throw new Error('Trying to process updates with no shareDoc')
    }

    for (const transaction of transactions) {
      if (transaction.docChanged) {
        const origin = chooseOrigin(transaction)

        if (origin === 'remote') {
          return
        }

        if (
          this.maxDocLength &&
          transaction.changes.desc.newLength >= this.maxDocLength
        ) {
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

            this.emit('change', this, { origin, inserted, removed })
          }
        )
      }
    }
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
