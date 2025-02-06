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
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

export type Ranges = {
  docId: string
  total: number
  changes: Change<EditOperation>[]
  comments: Change<CommentOperation>[]
}

export const RangesContext = createContext<Ranges | undefined>(undefined)

type RangesActions = {
  acceptChanges: (...ids: string[]) => void
  rejectChanges: (...ids: string[]) => void
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
    total: ranges.changes.length + ranges.comments.length,
  }
}

const RangesActionsContext = createContext<RangesActions | undefined>(undefined)

export const RangesProvider: FC = ({ children }) => {
  const view = useCodeMirrorViewContext()
  const { projectId } = useIdeReactContext()
  const { currentDocument } = useEditorManagerContext()
  const { socket } = useConnectionContext()
  const [ranges, setRanges] = useState<Ranges | undefined>(() =>
    buildRanges(currentDocument)
  )

  // rebuild the ranges when the current doc changes
  useEffect(() => {
    setRanges(buildRanges(currentDocument))
  }, [currentDocument])

  useEffect(() => {
    if (currentDocument) {
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

  const actions = useMemo(
    () => ({
      async acceptChanges(...ids: string[]) {
        if (currentDocument?.ranges) {
          const url = `/project/${projectId}/doc/${currentDocument.doc_id}/changes/accept`
          await postJSON(url, { body: { change_ids: ids } })
          currentDocument.ranges.removeChangeIds(ids)
          setRanges(buildRanges(currentDocument))
        }
      },
      rejectChanges(...ids: string[]) {
        if (currentDocument?.ranges) {
          view.dispatch(rejectChanges(view.state, currentDocument.ranges, ids))
        }
      },
    }),
    [currentDocument, projectId, view]
  )

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
