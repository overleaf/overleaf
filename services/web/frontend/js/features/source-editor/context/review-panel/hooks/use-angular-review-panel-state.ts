import { useState, useMemo, useCallback } from 'react'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import useLayoutToLeft from '@/features/ide-react/context/review-panel/hooks/useLayoutToLeft'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import { ReviewPanelState } from '../types/review-panel-state'
import * as ReviewPanel from '../types/review-panel-state'
import {
  SubView,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { DocId } from '../../../../../../../types/project-settings'
import { dispatchReviewPanelLayout as handleLayoutChange } from '../../../extensions/changes/change-manager'

function useAngularReviewPanelState(): ReviewPanelState {
  const [subView, setSubView] = useScopeValue<ReviewPanel.Value<'subView'>>(
    'reviewPanel.subView'
  )
  const [isOverviewLoading] = useScopeValue<
    ReviewPanel.Value<'isOverviewLoading'>
  >('reviewPanel.overview.loading')
  const [nVisibleSelectedChanges] = useScopeValue<
    ReviewPanel.Value<'nVisibleSelectedChanges'>
  >('reviewPanel.nVisibleSelectedChanges')
  const [collapsed, setCollapsed] = useScopeValue<
    ReviewPanel.Value<'collapsed'>
  >('reviewPanel.overview.docsCollapsedState')
  const [commentThreads] = useScopeValue<ReviewPanel.Value<'commentThreads'>>(
    'reviewPanel.commentThreads',
    true
  )
  const [entries] = useScopeValue<ReviewPanel.Value<'entries'>>(
    'reviewPanel.entries',
    true
  )
  const [loadingThreads] =
    useScopeValue<ReviewPanel.Value<'loadingThreads'>>('loadingThreads')

  const [permissions] =
    useScopeValue<ReviewPanel.Value<'permissions'>>('permissions')
  const [users] = useScopeValue<ReviewPanel.Value<'users'>>('users', true)
  const [resolvedComments] = useScopeValue<
    ReviewPanel.Value<'resolvedComments'>
  >('reviewPanel.resolvedComments', true)

  const [wantTrackChanges] = useScopeValue<
    ReviewPanel.Value<'wantTrackChanges'>
  >('editor.wantTrackChanges')
  const [openDocId] =
    useScopeValue<ReviewPanel.Value<'openDocId'>>('editor.open_doc_id')
  const [shouldCollapse, setShouldCollapse] = useScopeValue<
    ReviewPanel.Value<'shouldCollapse'>
  >('reviewPanel.fullTCStateCollapsed')
  const [lineHeight] = useScopeValue<number>(
    'reviewPanel.rendererData.lineHeight'
  )

  const [toggleTrackChangesForEveryone] = useScopeValue<
    ReviewPanel.UpdaterFn<'toggleTrackChangesForEveryone'>
  >('toggleTrackChangesForEveryone')
  const [toggleTrackChangesForUser] = useScopeValue<
    ReviewPanel.UpdaterFn<'toggleTrackChangesForUser'>
  >('toggleTrackChangesForUser')
  const [toggleTrackChangesForGuests] = useScopeValue<
    ReviewPanel.UpdaterFn<'toggleTrackChangesForGuests'>
  >('toggleTrackChangesForGuests')

  const [trackChangesState] = useScopeValue<
    ReviewPanel.Value<'trackChangesState'>
  >('reviewPanel.trackChangesState')
  const [trackChangesOnForEveryone] = useScopeValue<
    ReviewPanel.Value<'trackChangesOnForEveryone'>
  >('reviewPanel.trackChangesOnForEveryone')
  const [trackChangesOnForGuests] = useScopeValue<
    ReviewPanel.Value<'trackChangesOnForGuests'>
  >('reviewPanel.trackChangesOnForGuests')
  const [trackChangesForGuestsAvailable] = useScopeValue<
    ReviewPanel.Value<'trackChangesForGuestsAvailable'>
  >('reviewPanel.trackChangesForGuestsAvailable')
  const [resolveComment] =
    useScopeValue<ReviewPanel.UpdaterFn<'resolveComment'>>('resolveComment')
  const [submitNewComment] =
    useScopeValue<ReviewPanel.UpdaterFn<'submitNewComment'>>('submitNewComment')
  const [deleteComment] =
    useScopeValue<ReviewPanel.UpdaterFn<'deleteComment'>>('deleteComment')
  const [gotoEntry] =
    useScopeValue<ReviewPanel.UpdaterFn<'gotoEntry'>>('gotoEntry')
  const [saveEdit] =
    useScopeValue<ReviewPanel.UpdaterFn<'saveEdit'>>('saveEdit')
  const [submitReplyAngular] =
    useScopeValue<
      (entry: { thread_id: ThreadId; replyContent: string }) => void
    >('submitReply')

  const [formattedProjectMembers] = useScopeValue<
    ReviewPanel.Value<'formattedProjectMembers'>
  >('reviewPanel.formattedProjectMembers')

  const [toggleReviewPanel] =
    useScopeValue<ReviewPanel.UpdaterFn<'toggleReviewPanel'>>(
      'toggleReviewPanel'
    )
  const [unresolveComment] =
    useScopeValue<ReviewPanel.UpdaterFn<'unresolveComment'>>('unresolveComment')

  const [deleteThreadAngular] =
    useScopeValue<
      (
        _: unknown,
        ...args: [...Parameters<ReviewPanel.UpdaterFn<'deleteThread'>>]
      ) => ReturnType<ReviewPanel.UpdaterFn<'deleteThread'>>
    >('deleteThread')
  const deleteThread = useCallback(
    (docId: DocId, threadId: ThreadId) => {
      deleteThreadAngular(undefined, docId, threadId)
    },
    [deleteThreadAngular]
  )

  const [refreshResolvedCommentsDropdown] = useScopeValue<
    ReviewPanel.UpdaterFn<'refreshResolvedCommentsDropdown'>
  >('refreshResolvedCommentsDropdown')
  const [acceptChanges] =
    useScopeValue<ReviewPanel.UpdaterFn<'acceptChanges'>>('acceptChanges')
  const [rejectChanges] =
    useScopeValue<ReviewPanel.UpdaterFn<'rejectChanges'>>('rejectChanges')
  const [bulkAcceptActions] =
    useScopeValue<ReviewPanel.UpdaterFn<'bulkAcceptActions'>>(
      'bulkAcceptActions'
    )
  const [bulkRejectActions] =
    useScopeValue<ReviewPanel.UpdaterFn<'bulkRejectActions'>>(
      'bulkRejectActions'
    )

  const layoutToLeft = useLayoutToLeft('#editor')

  const handleSetSubview = useCallback(
    (subView: SubView) => {
      setSubView(subView)
      sendMB('rp-subview-change', { subView })
    },
    [setSubView]
  )

  const submitReply = useCallback(
    (threadId: ThreadId, replyContent: string) => {
      submitReplyAngular({ thread_id: threadId, replyContent })
    },
    [submitReplyAngular]
  )

  const [isAddingComment, setIsAddingComment] = useState(false)
  const [navHeight, setNavHeight] = useState(0)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [layoutSuspended, setLayoutSuspended] = useState(false)
  const [unsavedComment, setUnsavedComment] = useState('')

  const values = useMemo<ReviewPanelState['values']>(
    () => ({
      collapsed,
      commentThreads,
      entries,
      isAddingComment,
      loadingThreads,
      nVisibleSelectedChanges,
      permissions,
      users,
      resolvedComments,
      shouldCollapse,
      navHeight,
      toolbarHeight,
      subView,
      wantTrackChanges,
      isOverviewLoading,
      openDocId,
      lineHeight,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
      layoutSuspended,
      unsavedComment,
      layoutToLeft,
    }),
    [
      collapsed,
      commentThreads,
      entries,
      isAddingComment,
      loadingThreads,
      nVisibleSelectedChanges,
      permissions,
      users,
      resolvedComments,
      shouldCollapse,
      navHeight,
      toolbarHeight,
      subView,
      wantTrackChanges,
      isOverviewLoading,
      openDocId,
      lineHeight,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
      layoutSuspended,
      unsavedComment,
      layoutToLeft,
    ]
  )

  const updaterFns = useMemo<ReviewPanelState['updaterFns']>(
    () => ({
      handleSetSubview,
      handleLayoutChange,
      gotoEntry,
      resolveComment,
      submitReply,
      acceptChanges,
      rejectChanges,
      toggleReviewPanel,
      bulkAcceptActions,
      bulkRejectActions,
      saveEdit,
      submitNewComment,
      deleteComment,
      unresolveComment,
      refreshResolvedCommentsDropdown,
      deleteThread,
      toggleTrackChangesForEveryone,
      toggleTrackChangesForUser,
      toggleTrackChangesForGuests,
      setCollapsed,
      setShouldCollapse,
      setIsAddingComment,
      setNavHeight,
      setToolbarHeight,
      setLayoutSuspended,
      setUnsavedComment,
    }),
    [
      handleSetSubview,
      gotoEntry,
      resolveComment,
      submitReply,
      acceptChanges,
      rejectChanges,
      toggleReviewPanel,
      bulkAcceptActions,
      bulkRejectActions,
      saveEdit,
      submitNewComment,
      deleteComment,
      unresolveComment,
      refreshResolvedCommentsDropdown,
      deleteThread,
      toggleTrackChangesForEveryone,
      toggleTrackChangesForUser,
      toggleTrackChangesForGuests,
      setCollapsed,
      setShouldCollapse,
      setIsAddingComment,
      setNavHeight,
      setToolbarHeight,
      setLayoutSuspended,
      setUnsavedComment,
    ]
  )

  return { values, updaterFns }
}

export default useAngularReviewPanelState
