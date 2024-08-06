import {
  CommentId,
  ReviewPanelCommentThreads,
  ReviewPanelDocEntries,
  ReviewPanelEntries,
  ReviewPanelUsers,
  SubView,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { Permissions } from '@/features/ide-react/types/permissions'
import { DocId } from '../../../../../../../types/project-settings'
import { dispatchReviewPanelLayout } from '../../../extensions/changes/change-manager'
import { UserId } from '../../../../../../../types/user'

export interface ReviewPanelState {
  values: {
    collapsed: Record<DocId, boolean>
    commentThreads: ReviewPanelCommentThreads
    entries: ReviewPanelEntries
    isAddingComment: boolean
    loadingThreads: boolean
    nVisibleSelectedChanges: number
    permissions: Permissions
    users: ReviewPanelUsers
    resolvedComments: ReviewPanelEntries
    shouldCollapse: boolean
    navHeight: number
    toolbarHeight: number
    subView: SubView
    wantTrackChanges: boolean
    isOverviewLoading: boolean
    openDocId: DocId | null
    lineHeight: number
    trackChangesState:
      | Record<UserId, { value: boolean; syncState: 'synced' | 'pending' }>
      | Record<UserId, undefined>
    trackChangesOnForEveryone: boolean
    trackChangesOnForGuests: boolean
    trackChangesForGuestsAvailable: boolean
    formattedProjectMembers: Record<
      string,
      {
        id: UserId
        name: string
      }
    >
    layoutSuspended: boolean
    unsavedComment: string
    layoutToLeft: boolean
  }
  updaterFns: {
    handleSetSubview: (subView: SubView) => void
    handleLayoutChange: (
      ...args: Parameters<typeof dispatchReviewPanelLayout>
    ) => void
    gotoEntry: (docId: DocId, entryOffset: number) => void
    resolveComment: (docId: DocId, entryId: ThreadId) => void
    deleteComment: (threadId: ThreadId, commentId: CommentId) => void
    submitReply: (threadId: ThreadId, replyContent: string) => void
    acceptChanges: (entryIds: ThreadId[]) => void
    rejectChanges: (entryIds: ThreadId[]) => void
    toggleTrackChangesForEveryone: (onForEveryone: boolean) => void
    toggleTrackChangesForUser: (onForUser: boolean, userId: UserId) => void
    toggleTrackChangesForGuests: (onForGuests: boolean) => void
    toggleReviewPanel: () => void
    bulkAcceptActions: () => void
    bulkRejectActions: () => void
    saveEdit: (
      threadId: ThreadId,
      commentId: CommentId,
      content: string
    ) => void
    unresolveComment: (docId: DocId, threadId: ThreadId) => void
    deleteThread: (docId: DocId, threadId: ThreadId) => void
    refreshResolvedCommentsDropdown: () => Promise<
      void | ReviewPanelDocEntries[]
    >
    submitNewComment: (content: string) => void
    setIsAddingComment: React.Dispatch<
      React.SetStateAction<Value<'isAddingComment'>>
    >
    setCollapsed: React.Dispatch<React.SetStateAction<Value<'collapsed'>>>
    setShouldCollapse: React.Dispatch<
      React.SetStateAction<Value<'shouldCollapse'>>
    >
    setNavHeight: React.Dispatch<React.SetStateAction<Value<'navHeight'>>>
    setToolbarHeight: React.Dispatch<
      React.SetStateAction<Value<'toolbarHeight'>>
    >
    setLayoutSuspended: React.Dispatch<
      React.SetStateAction<Value<'layoutSuspended'>>
    >
    setUnsavedComment: React.Dispatch<
      React.SetStateAction<Value<'unsavedComment'>>
    >
  }
}

// Getter for values
export type Value<T extends keyof ReviewPanelState['values']> =
  ReviewPanelState['values'][T]

// Getter for stable functions
export type UpdaterFn<T extends keyof ReviewPanelState['updaterFns']> =
  ReviewPanelState['updaterFns'][T]
