import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import {
  Change,
  CommentOperation,
  EditOperation,
} from '../../../../../types/change'
import RangesTracker from '@overleaf/ranges-tracker'
import { rejectChanges } from '@/features/source-editor/extensions/changes/reject-changes'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'
import { postJSON } from '@/infrastructure/fetch-json'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { throttle } from 'lodash'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { TextOperation, Range } from 'overleaf-editor-core'
import { rangesUpdatedEffect } from '@/features/source-editor/extensions/history-ot'
import ClearTrackingProps from 'overleaf-editor-core/lib/file_data/clear_tracking_props'
import { isInsertOperation } from '@/utils/operations'
import {
  EditorSelection,
  Transaction,
  TransactionSpec,
} from '@codemirror/state'
import { buildRangesFromSnapshot } from '@/features/review-panel/utils/snapshot-ranges'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useReviewPanelViewContext } from './review-panel-view-context'

export type Ranges = {
  docId: string
  changes: Array<Change<EditOperation> & { snapshotRange?: Range }>
  comments: Array<
    Change<CommentOperation> & { snapshotRange?: Range; resolved?: boolean }
  >
}

export const RangesContext = createContext<Ranges | undefined>(undefined)

type RangesActions = {
  acceptChanges: (
    ...changes: Array<Change<EditOperation> & { snapshotRange?: Range }>
  ) => Promise<void>
  rejectChanges: (
    ...changes: Array<Change<EditOperation> & { snapshotRange?: Range }>
  ) => Promise<void>
}

const buildRanges = (currentDocument: DocumentContainer | null) => {
  const ranges = currentDocument?.ranges

  if (!ranges) {
    return undefined
  }

  const dirtyState = ranges.getDirtyState()
  ranges.resetDirtyState()

  const changed = {
    changes: new Set([
      ...Object.keys(dirtyState.change.added),
      ...Object.keys(dirtyState.change.moved),
      ...Object.keys(dirtyState.change.removed),
    ]),
    comments: new Set([
      ...Object.keys(dirtyState.comment.added),
      ...Object.keys(dirtyState.comment.moved),
      ...Object.keys(dirtyState.comment.removed),
    ]),
  }

  return {
    changes:
      changed.changes.size > 0
        ? ranges.changes.map(change =>
            changed.changes.has(change.id) ? { ...change } : change
          )
        : ranges.changes,
    comments:
      changed.comments.size > 0
        ? ranges.comments.map(comment =>
            changed.comments.has(comment.id) ? { ...comment } : comment
          )
        : ranges.comments,
    docId: currentDocument.doc_id,
  }
}

const buildRangesFromHistoryOT = (currentDocument: DocumentContainer) => {
  return buildRangesFromSnapshot(
    currentDocument.historyOTShareDoc.snapshot,
    currentDocument.doc_id
  )
}

const RangesActionsContext = createContext<RangesActions | undefined>(undefined)

export const RangesProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const view = useCodeMirrorViewContext()
  const { projectId } = useIdeReactContext()
  const { currentDocument } = useEditorOpenDocContext()
  const { socket } = useConnectionContext()
  const { sendEvent } = useEditorAnalytics()
  const [ranges, setRanges] = useState<Ranges | undefined>(() =>
    buildRanges(currentDocument)
  )
  const reviewPanelView = useReviewPanelViewContext()

  // rebuild the ranges when the current doc changes
  useEffect(() => {
    if (currentDocument) {
      if (currentDocument.isHistoryOT()) {
        setRanges(buildRangesFromHistoryOT(currentDocument))
      } else {
        setRanges(buildRanges(currentDocument))
      }
    }
  }, [currentDocument])

  useEffect(() => {
    if (currentDocument && currentDocument.isHistoryOT()) {
      const listener = throttle(
        () => {
          window.setTimeout(() => {
            setRanges(buildRangesFromHistoryOT(currentDocument))
          })
        },
        500,
        { leading: true, trailing: true }
      )

      currentDocument.on('ranges:dirty.ot', listener)

      return () => {
        currentDocument.off('ranges:dirty.ot')
      }
    }
  }, [currentDocument])

  useEffect(() => {
    if (currentDocument && !currentDocument.isHistoryOT()) {
      const listener = throttle(
        () => {
          window.setTimeout(() => {
            setRanges(buildRanges(currentDocument))
          })
        },
        500,
        { leading: true, trailing: true }
      )

      // currentDocument.on('ranges:clear.cm6', listener)
      currentDocument.on('ranges:redraw.cm6', listener)
      currentDocument.on('ranges:dirty.cm6', listener)

      return () => {
        // currentDocument.off('ranges:clear.cm6')
        currentDocument.off('ranges:redraw.cm6')
        currentDocument.off('ranges:dirty.cm6')
      }
    }
  }, [currentDocument])

  // TODO: move this into DocumentContainer?
  useEffect(() => {
    if (currentDocument) {
      const regenerateTrackChangesId = (doc: DocumentContainer) => {
        if (doc.ranges) {
          const inflight = doc.ranges.getIdSeed()
          const pending = RangesTracker.generateIdSeed()
          doc.ranges.setIdSeed(pending)
          doc.setTrackChangesIdSeeds({ pending, inflight })
        }
      }

      currentDocument.on('flipped_pending_to_inflight', () =>
        regenerateTrackChangesId(currentDocument)
      )

      regenerateTrackChangesId(currentDocument)

      return () => {
        currentDocument.off('flipped_pending_to_inflight')
      }
    }
  }, [currentDocument])

  useSocketListener(
    socket,
    'accept-changes',
    useCallback(
      (docId: string, entryIds: string[]) => {
        if (currentDocument?.ranges) {
          if (docId === currentDocument.doc_id) {
            currentDocument.ranges.removeChangeIds(entryIds)
            setRanges(buildRanges(currentDocument))
          }
        }
      },
      [currentDocument]
    )
  )

  const actions = useMemo(() => {
    if (!currentDocument) {
      return
    }

    if (currentDocument.isHistoryOT()) {
      return {
        async acceptChanges(...changes) {
          const op = new TextOperation()

          let currentSnapshotPos = 0
          for (const change of changes) {
            const { start, end, length } = change.snapshotRange!

            if (start > currentSnapshotPos) {
              op.retain(start - currentSnapshotPos)
            }

            currentSnapshotPos = end

            if (isInsertOperation(change.op)) {
              // accept tracked insertion

              // clear tracking from snapshot
              op.retain({ r: length }, { tracking: new ClearTrackingProps() }) // TODO: { type: 'none' })
            } else {
              // accept tracked deletion

              // remove text from snapshot
              op.remove(length) // NOTE: tracking is removed automatically
            }
          }

          const shareDoc = currentDocument.historyOTShareDoc

          const length = shareDoc.snapshot.getStringLength()

          if (currentSnapshotPos < length) {
            op.retain(length - currentSnapshotPos)
          }

          shareDoc.submitOp([op])
          sendEvent('rp-changes-accepted', {
            count: changes.length,
            view: reviewPanelView,
          })

          // dispatch an effect as the editor's doc doesn't change when tracked changes are accepted
          view.dispatch({
            effects: rangesUpdatedEffect.of(null),
          })
        },
        async rejectChanges(...changes) {
          const shareDoc = currentDocument.historyOTShareDoc

          const originalLength = shareDoc.snapshot.getStringLength()

          const op = new TextOperation()

          let currentSnapshotPos = 0
          const specs: TransactionSpec[] = []
          for (const change of changes) {
            const { start, end, length } = change.snapshotRange!

            if (start > currentSnapshotPos) {
              op.retain(start - currentSnapshotPos)
            }

            currentSnapshotPos = end

            if (isInsertOperation(change.op)) {
              // reject tracked insertion

              // remove text from snapshot
              op.remove(length) // NOTE: tracking is removed automatically

              // remove text from editor
              specs.push({
                changes: {
                  from: change.op.p,
                  to: change.op.p + change.op.i.length,
                  insert: '',
                },
                annotations: [
                  Transaction.remote.of(true),
                  // Transaction.addToHistory.of(false), // TODO: is this needed for the undo stack?
                ],
              })
            } else {
              // reject tracked deletion

              // remove tracking from snapshot
              op.retain({ r: length }, { tracking: new ClearTrackingProps() }) // TODO: { type: 'none' })

              // re-add text to editor
              specs.push({
                changes: {
                  from: change.op.p,
                  insert: change.op.d,
                },
                selection: EditorSelection.cursor(
                  change.op.p + change.op.d.length
                ), // TODO: map selection through changes?
                annotations: [
                  Transaction.remote.of(true),
                  // Transaction.addToHistory.of(false), // TODO: is this needed for the undo stack?
                ],
              })
            }
          }

          if (currentSnapshotPos < originalLength) {
            op.retain(originalLength - currentSnapshotPos)
          }

          shareDoc.submitOp([op])
          sendEvent('rp-changes-rejected', {
            count: changes.length,
            view: reviewPanelView,
          })

          // in case the doc didn't change
          view.dispatch(...specs, {
            effects: rangesUpdatedEffect.of(null),
          })
        },
      } satisfies RangesActions
    } else {
      return {
        async acceptChanges(...changes) {
          if (currentDocument.ranges) {
            const ids = changes.map(change => change.id)
            const url = `/project/${projectId}/doc/${currentDocument.doc_id}/changes/accept`
            await postJSON(url, { body: { change_ids: ids } })
            currentDocument.ranges.removeChangeIds(ids)
            setRanges(buildRanges(currentDocument))
            sendEvent('rp-changes-accepted', {
              count: ids.length,
              view: reviewPanelView,
            })
          }
        },
        async rejectChanges(...changes) {
          if (currentDocument.ranges) {
            const ids = changes.map(change => change.id)
            view.dispatch(
              rejectChanges(view.state, currentDocument.ranges, ids)
            )
            sendEvent('rp-changes-rejected', {
              count: ids.length,
              view: reviewPanelView,
            })
          }
        },
      } satisfies RangesActions
    }
  }, [currentDocument, projectId, view, sendEvent, reviewPanelView])

  if (!actions) {
    return null
  }

  return (
    <RangesActionsContext.Provider value={actions}>
      <RangesContext.Provider value={ranges}>{children}</RangesContext.Provider>
    </RangesActionsContext.Provider>
  )
}

export const useRangesContext = () => {
  return useContext(RangesContext)
}

export const useRangesActionsContext = () => {
  const context = useContext(RangesActionsContext)
  if (!context) {
    throw new Error(
      'useRangesActionsContext is only available inside RangesProvider'
    )
  }
  return context
}
