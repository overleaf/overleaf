import {
  CommentId,
  DocId,
  ReviewPanelCommentThreads,
  ReviewPanelEntries,
  ReviewPanelPermissions,
  SubView,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { ReviewPanelCommentEntry } from '../../../../../../../types/review-panel/entry'

export interface ReviewPanelState {
  values: {
    collapsed: Record<string, boolean>
    commentThreads: ReviewPanelCommentThreads
    deleteComment: (threadId: ThreadId, commentId: CommentId) => void
    entries: ReviewPanelEntries
    entryHover: boolean
    gotoEntry: (docId: DocId, entryOffset: number) => void
    handleLayoutChange: () => void
    loadingThreads: boolean
    permissions: ReviewPanelPermissions
    resolveComment: (docId: DocId, entryId: ThreadId) => void
    saveEdit: (
      threadId: ThreadId,
      commentId: CommentId,
      content: string
    ) => void
    shouldCollapse: boolean
    submitReply: (entry: ReviewPanelCommentEntry, replyContent: string) => void
    subView: SubView
    wantTrackChanges: boolean
    openDocId: DocId | null
    toggleTrackChangesForEveryone: (isOn: boolean) => unknown
    toggleTrackChangesForUser: (isOn: boolean, memberId: string) => unknown
    toggleTrackChangesForGuests: (isOn: boolean) => unknown
    trackChangesState: Record<string, { value: boolean; syncState: string }>
    trackChangesOnForEveryone: boolean
    trackChangesOnForGuests: boolean
    trackChangesForGuestsAvailable: boolean
    formattedProjectMembers: Record<
      string,
      {
        id: string
        name: string
      }
    >
    toggleReviewPanel: () => void
  }
  updaterFns: {
    handleSetSubview: (subView: SubView) => void
    setEntryHover: React.Dispatch<React.SetStateAction<boolean>>
    setCollapsed: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['collapsed']>
    >
    setShouldCollapse: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['shouldCollapse']>
    >
  }
}

// Getter for values
export type Value<T extends keyof ReviewPanelState['values']> =
  ReviewPanelState['values'][T]
