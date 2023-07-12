import { useState, useMemo, useCallback } from 'react'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import useScopeEventEmitter from '../../../../../shared/hooks/use-scope-event-emitter'
import { ReviewPanelState } from '../types/review-panel-state'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import * as ReviewPanel from '../types/review-panel-state'
import { SubView } from '../../../../../../../types/review-panel/review-panel'
import { ReviewPanelCommentEntry } from '../../../../../../../types/review-panel/entry'

function useAngularReviewPanelState(): ReviewPanelState {
  const emitLayoutChange = useScopeEventEmitter('review-panel:layout', false)

  const [subView, setSubView] = useScopeValue<ReviewPanel.Value<'subView'>>(
    'reviewPanel.subView'
  )
  const [loading] = useScopeValue<ReviewPanel.Value<'loading'>>(
    'reviewPanel.overview.loading'
  )
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
  const [docs] = useScopeValue<ReviewPanel.Value<'docs'>>('docs')
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

  const [toggleTrackChangesForEveryone] = useScopeValue<
    ReviewPanel.Value<'toggleTrackChangesForEveryone'>
  >('toggleTrackChangesForEveryone')
  const [toggleTrackChangesForUser] = useScopeValue<
    ReviewPanel.Value<'toggleTrackChangesForUser'>
  >('toggleTrackChangesForUser')
  const [toggleTrackChangesForGuests] = useScopeValue<
    ReviewPanel.Value<'toggleTrackChangesForGuests'>
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
    useScopeValue<ReviewPanel.Value<'resolveComment'>>('resolveComment')
  const [submitNewComment] =
    useScopeValue<ReviewPanel.Value<'submitNewComment'>>('submitNewComment')
  const [deleteComment] =
    useScopeValue<ReviewPanel.Value<'deleteComment'>>('deleteComment')
  const [gotoEntry] = useScopeValue<ReviewPanel.Value<'gotoEntry'>>('gotoEntry')
  const [saveEdit] = useScopeValue<ReviewPanel.Value<'saveEdit'>>('saveEdit')
  const [submitReplyAngular] =
    useScopeValue<(entry: ReviewPanelCommentEntry) => void>('submitReply')

  const [formattedProjectMembers] = useScopeValue<
    ReviewPanel.Value<'formattedProjectMembers'>
  >('reviewPanel.formattedProjectMembers')

  const [toggleReviewPanel] =
    useScopeValue<ReviewPanel.Value<'toggleReviewPanel'>>('toggleReviewPanel')
  const [unresolveComment] =
    useScopeValue<ReviewPanel.Value<'unresolveComment'>>('unresolveComment')
  const [deleteThread] =
    useScopeValue<ReviewPanel.Value<'deleteThread'>>('deleteThread')
  const [refreshResolvedCommentsDropdown] = useScopeValue<
    ReviewPanel.Value<'refreshResolvedCommentsDropdown'>
  >('refreshResolvedCommentsDropdown')
  const [acceptChanges] =
    useScopeValue<ReviewPanel.Value<'acceptChanges'>>('acceptChanges')
  const [rejectChanges] =
    useScopeValue<ReviewPanel.Value<'rejectChanges'>>('rejectChanges')
  const [bulkAcceptActions] =
    useScopeValue<ReviewPanel.Value<'bulkAcceptActions'>>('bulkAcceptActions')
  const [bulkRejectActions] =
    useScopeValue<ReviewPanel.Value<'bulkRejectActions'>>('bulkRejectActions')

  const handleSetSubview = useCallback(
    (subView: SubView) => {
      setSubView(subView)
      sendMB('rp-subview-change', { subView })
    },
    [setSubView]
  )

  const handleLayoutChange = useCallback(() => {
    window.requestAnimationFrame(() => {
      emitLayoutChange()
    })
  }, [emitLayoutChange])

  const submitReply = useCallback(
    (entry: ReviewPanelCommentEntry, replyContent: string) => {
      submitReplyAngular({ ...entry, replyContent })
    },
    [submitReplyAngular]
  )

  const [entryHover, setEntryHover] = useState(false)
  const [isAddingComment, setIsAddingComment] = useState(false)

  const values = useMemo<ReviewPanelState['values']>(
    () => ({
      collapsed,
      commentThreads,
      deleteComment,
      docs,
      entries,
      entryHover,
      isAddingComment,
      gotoEntry,
      handleLayoutChange,
      loadingThreads,
      nVisibleSelectedChanges,
      permissions,
      users,
      resolveComment,
      resolvedComments,
      saveEdit,
      shouldCollapse,
      submitReply,
      subView,
      wantTrackChanges,
      loading,
      openDocId,
      toggleTrackChangesForEveryone,
      toggleTrackChangesForUser,
      toggleTrackChangesForGuests,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
      toggleReviewPanel,
      bulkAcceptActions,
      bulkRejectActions,
      unresolveComment,
      deleteThread,
      refreshResolvedCommentsDropdown,
      acceptChanges,
      rejectChanges,
      submitNewComment,
    }),
    [
      collapsed,
      commentThreads,
      deleteComment,
      docs,
      entries,
      entryHover,
      isAddingComment,
      gotoEntry,
      handleLayoutChange,
      loadingThreads,
      nVisibleSelectedChanges,
      permissions,
      users,
      resolveComment,
      resolvedComments,
      saveEdit,
      shouldCollapse,
      submitReply,
      subView,
      wantTrackChanges,
      loading,
      openDocId,
      toggleTrackChangesForEveryone,
      toggleTrackChangesForUser,
      toggleTrackChangesForGuests,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
      toggleReviewPanel,
      bulkAcceptActions,
      bulkRejectActions,
      unresolveComment,
      deleteThread,
      refreshResolvedCommentsDropdown,
      acceptChanges,
      rejectChanges,
      submitNewComment,
    ]
  )

  const updaterFns = useMemo<ReviewPanelState['updaterFns']>(
    () => ({
      handleSetSubview,
      setEntryHover,
      setCollapsed,
      setShouldCollapse,
      setIsAddingComment,
    }),
    [
      handleSetSubview,
      setCollapsed,
      setEntryHover,
      setShouldCollapse,
      setIsAddingComment,
    ]
  )

  return { values, updaterFns }
}

export default useAngularReviewPanelState
