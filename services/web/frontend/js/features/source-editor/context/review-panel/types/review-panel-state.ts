import {
  CommentId,
  ReviewPanelCommentThreads,
  ReviewPanelEntries,
  ReviewPanelPermissions,
  ReviewPanelUsers,
  SubView,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { ReviewPanelCommentEntry } from '../../../../../../../types/review-panel/entry'
import {
  DocId,
  MainDocument,
} from '../../../../../../../types/project-settings'

export interface ReviewPanelState {
  values: {
    collapsed: Record<DocId, boolean>
    commentThreads: ReviewPanelCommentThreads
    deleteComment: (threadId: ThreadId, commentId: CommentId) => void
    docs: MainDocument[] | undefined
    entries: ReviewPanelEntries
    entryHover: boolean
    gotoEntry: (docId: DocId, entryOffset: number) => void
    handleLayoutChange: () => void
    loadingThreads: boolean
    permissions: ReviewPanelPermissions
    users: ReviewPanelUsers
    resolveComment: (docId: DocId, entryId: ThreadId) => void
    resolvedComments: ReviewPanelEntries
    saveEdit: (
      threadId: ThreadId,
      commentId: CommentId,
      content: string
    ) => void
    shouldCollapse: boolean
    submitReply: (entry: ReviewPanelCommentEntry, replyContent: string) => void
    subView: SubView
    wantTrackChanges: boolean
    loading: boolean
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
    unresolveComment: (threadId: ThreadId) => void
    deleteThread: (_entryId: unknown, docId: DocId, threadId: ThreadId) => void
    refreshResolvedCommentsDropdown: () => Promise<void>
    acceptChanges: (entryIds: unknown) => void
    rejectChanges: (entryIds: unknown) => void
    submitNewComment: (content: string) => void
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
