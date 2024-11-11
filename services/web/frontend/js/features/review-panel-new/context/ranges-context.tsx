import {
  createContext,
  FC,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import useScopeValue from '@/shared/hooks/use-scope-value'
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

const buildRanges = (currentDoc: DocumentContainer | null) => {
  const ranges = currentDoc?.ranges

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
    docId: currentDoc.doc_id,
    total: ranges.changes.length + ranges.comments.length,
  }
}

const RangesActionsContext = createContext<RangesActions | undefined>(undefined)

export const RangesProvider: FC = ({ children }) => {
  const view = useCodeMirrorViewContext()
  const { projectId } = useIdeReactContext()
  const [currentDoc] = useScopeValue<DocumentContainer | null>(
    'editor.sharejs_doc'
  )

  const [ranges, setRanges] = useState<Ranges | undefined>(() =>
    buildRanges(currentDoc)
  )

  // rebuild the ranges when the current doc changes
  useEffect(() => {
    setRanges(buildRanges(currentDoc))
  }, [currentDoc])

  useEffect(() => {
    if (currentDoc) {
      const listener = () => {
        setRanges(buildRanges(currentDoc))
      }

      // currentDoc.on('ranges:clear.cm6', listener)
      currentDoc.on('ranges:redraw.cm6', listener)
      currentDoc.on('ranges:dirty.cm6', listener)

      return () => {
        // currentDoc.off('ranges:clear.cm6')
        currentDoc.off('ranges:redraw.cm6')
        currentDoc.off('ranges:dirty.cm6')
      }
    }
  }, [currentDoc])

  // TODO: move this into DocumentContainer?
  useEffect(() => {
    if (currentDoc) {
      const regenerateTrackChangesId = (doc: DocumentContainer) => {
        if (doc.ranges) {
          const inflight = doc.ranges.getIdSeed()
          const pending = RangesTracker.generateIdSeed()
          doc.ranges.setIdSeed(pending)
          doc.setTrackChangesIdSeeds({ pending, inflight })
        }
      }

      currentDoc.on('flipped_pending_to_inflight', () =>
        regenerateTrackChangesId(currentDoc)
      )

      regenerateTrackChangesId(currentDoc)

      return () => {
        currentDoc.off('flipped_pending_to_inflight')
      }
    }
  }, [currentDoc])

  const actions = useMemo(
    () => ({
      async acceptChanges(...ids: string[]) {
        if (currentDoc?.ranges) {
          const url = `/project/${projectId}/doc/${currentDoc.doc_id}/changes/accept`
          await postJSON(url, { body: { change_ids: ids } })
          currentDoc.ranges.removeChangeIds(ids)
          setRanges(buildRanges(currentDoc))
        }
      },
      rejectChanges(...ids: string[]) {
        if (currentDoc?.ranges) {
          view.dispatch(rejectChanges(view.state, currentDoc.ranges, ids))
        }
      },
    }),
    [currentDoc, projectId, view]
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
