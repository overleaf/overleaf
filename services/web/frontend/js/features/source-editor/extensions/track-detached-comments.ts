import { EditorState, StateField, Transaction } from '@codemirror/state'
import {
  findCommentsInCut,
  findDetachedCommentsInChanges,
  restoreCommentsOnPaste,
  restoreDetachedComments,
  restoreDetachedCommentsEffect,
  StoredComment,
} from './changes/comments'
import { findDetachedHistoryOTCommentsInChanges } from './history-ot'
import { invertedEffects } from '@codemirror/commands'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'

/**
 * A custom extension that detects detached comments when a comment is cut and pasted,
 * or when a deleted comment is undone
 */
export const trackDetachedComments = ({
  currentDoc,
}: {
  currentDoc: DocumentContainer
}) => {
  // A state field that stored any comments found within the ranges of a "cut" transaction,
  // to be restored when pasting matching text.
  const cutCommentsState = StateField.define<StoredComment[]>({
    create: () => {
      return []
    },
    update: (value, transaction) => {
      // history-OT cut/paste restoration is handled atomically by the
      // updateSender in the historyOT extension
      if (currentDoc.isHistoryOT()) {
        return value
      }

      if (transaction.annotation(Transaction.remote)) {
        return value
      }

      if (!transaction.docChanged) {
        return value
      }

      if (transaction.isUserEvent('delete.cut')) {
        return findCommentsInCut(currentDoc, transaction)
      }

      if (transaction.isUserEvent('input.paste')) {
        restoreCommentsOnPaste(currentDoc, transaction, value)
        return []
      }

      return value
    },
  })

  return [
    // attach any comments detached by the transaction as an inverted effect, to be applied on undo
    invertedEffects.of(transaction => {
      if (
        transaction.docChanged &&
        !transaction.annotation(Transaction.remote)
      ) {
        const detachedComments = currentDoc.isHistoryOT()
          ? findDetachedHistoryOTCommentsInChanges(transaction)
          : findDetachedCommentsInChanges(currentDoc, transaction)
        if (detachedComments.size) {
          return [restoreDetachedCommentsEffect.of(detachedComments)]
        }
      }
      return []
    }),

    // restore any detached comments on undo (history-OT does this in updateSender)
    EditorState.transactionExtender.of(transaction => {
      if (currentDoc.isHistoryOT()) {
        return null
      }
      for (const effect of transaction.effects) {
        if (effect.is(restoreDetachedCommentsEffect)) {
          // send the comments to the ShareJS doc
          restoreDetachedComments(currentDoc, transaction, effect.value)
        }
      }
      return null
    }),

    cutCommentsState,
  ]
}
