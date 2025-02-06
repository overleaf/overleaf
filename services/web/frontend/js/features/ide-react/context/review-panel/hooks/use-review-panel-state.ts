import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isEqual, cloneDeep } from 'lodash'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import useAbortController from '@/shared/hooks/use-abort-controller'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'
import useLayoutToLeft from '@/features/ide-react/context/review-panel/hooks/useLayoutToLeft'
import { sendMB } from '@/infrastructure/event-tracking'
import {
  dispatchReviewPanelLayout as handleLayoutChange,
  UpdateType,
} from '@/features/source-editor/extensions/changes/change-manager'
import { useProjectContext } from '@/shared/context/project-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useUserContext } from '@/shared/context/user-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import {
  EditorManager,
  useEditorManagerContext,
} from '@/features/ide-react/context/editor-manager-context'
import { debugConsole } from '@/utils/debugging'
import { deleteJSON, getJSON, postJSON } from '@/infrastructure/fetch-json'
import RangesTracker from '@overleaf/ranges-tracker'
import type * as ReviewPanel from '@/features/source-editor/context/review-panel/types/review-panel-state'
import {
  CommentId,
  ReviewPanelCommentThreadMessage,
  ReviewPanelCommentThreads,
  ReviewPanelDocEntries,
  SubView,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { UserId } from '../../../../../../../types/user'
import { PublicAccessLevel } from '../../../../../../../types/public-access-level'
import {
  DeepReadonly,
  Entries,
  MergeAndOverride,
} from '../../../../../../../types/utils'
import { ReviewPanelCommentThread } from '../../../../../../../types/review-panel/comment-thread'
import { DocId } from '../../../../../../../types/project-settings'
import {
  ReviewPanelAddCommentEntry,
  ReviewPanelAggregateChangeEntry,
  ReviewPanelBulkActionsEntry,
  ReviewPanelChangeEntry,
  ReviewPanelCommentEntry,
  ReviewPanelEntry,
} from '../../../../../../../types/review-panel/entry'
import {
  ReviewPanelCommentThreadMessageApi,
  ReviewPanelCommentThreadsApi,
} from '../../../../../../../types/review-panel/api'
import { DateString } from '../../../../../../../types/helpers/date'
import {
  Change,
  CommentOperation,
  EditOperation,
} from '../../../../../../../types/change'
import { RangesTrackerWithResolvedThreadIds } from '@/features/ide-react/editor/document-container'
import getMeta from '@/utils/meta'
import { useEditorContext } from '@/shared/context/editor-context'
import { getHueForUserId } from '@/shared/utils/colors'

const dispatchReviewPanelEvent = (type: string, payload?: any) => {
  window.dispatchEvent(
    new CustomEvent('review-panel:event', {
      detail: { type, payload },
    })
  )
}

const formatUser = (user: any): any => {
  let isSelf, name
  const id =
    (user != null ? user._id : undefined) ||
    (user != null ? user.id : undefined)

  if (id == null) {
    return {
      email: null,
      name: 'Anonymous',
      isSelf: false,
      hue: getHueForUserId(),
      avatar_text: 'A',
    }
  }
  if (id === getMeta('ol-user_id')) {
    name = 'You'
    isSelf = true
  } else {
    name = [user.first_name, user.last_name]
      .filter(n => n != null && n !== '')
      .join(' ')
    if (name === '') {
      name =
        (user.email != null ? user.email.split('@')[0] : undefined) || 'Unknown'
    }
    isSelf = false
  }
  return {
    id,
    email: user.email,
    name,
    isSelf,
    hue: getHueForUserId(id),
    avatar_text: [user.first_name, user.last_name]
      .filter(n => n != null)
      .map(n => n[0])
      .join(''),
  }
}

const formatComment = (
  comment: ReviewPanelCommentThreadMessageApi
): ReviewPanelCommentThreadMessage => {
  const commentTyped = comment as unknown as ReviewPanelCommentThreadMessage
  commentTyped.user = formatUser(comment.user)
  commentTyped.timestamp = new Date(comment.timestamp)
  return commentTyped
}

function useReviewPanelState(): ReviewPanel.ReviewPanelState {
  const { t } = useTranslation()
  const { reviewPanelOpen, setReviewPanelOpen, setMiniReviewPanelVisible } =
    useLayoutContext()
  const { projectId } = useIdeReactContext()
  const project = useProjectContext()
  const user = useUserContext()
  const { socket } = useConnectionContext()
  const {
    features: { trackChangesVisible, trackChanges },
  } = project
  const { isRestrictedTokenMember } = useEditorContext()
  const {
    openDocWithId,
    currentDocument,
    currentDocumentId,
    wantTrackChanges,
    setWantTrackChanges,
  } = useEditorManagerContext() as MergeAndOverride<
    EditorManager,
    { currentDocumentId: DocId }
  >
  // TODO permissions to be removed from the review panel context. It currently acts just as a proxy.
  const permissions = usePermissionsContext()
  const { showGenericMessageModal } = useModalsContext()
  const addCommentEmitter = useScopeEventEmitter('comment:start_adding')

  const layoutToLeft = useLayoutToLeft('.ide-react-editor-panel')
  const [subView, setSubView] =
    useState<ReviewPanel.Value<'subView'>>('cur_file')
  const [isOverviewLoading, setIsOverviewLoading] =
    useState<ReviewPanel.Value<'isOverviewLoading'>>(false)
  // All selected changes. If an aggregated change (insertion + deletion) is selected, the two ids
  // will be present. The length of this array will differ from the count below (see explanation).
  const selectedEntryIds = useRef<ThreadId[]>([])
  // A count of user-facing selected changes. An aggregated change (insertion + deletion) will count
  // as only one.
  const [nVisibleSelectedChanges, setNVisibleSelectedChanges] =
    useState<ReviewPanel.Value<'nVisibleSelectedChanges'>>(0)
  const [collapsed, setCollapsed] = usePersistedState<
    ReviewPanel.Value<'collapsed'>
  >(`docs_collapsed_state:${projectId}`, {}, false, true)
  const [commentThreads, setCommentThreads] = useState<
    ReviewPanel.Value<'commentThreads'>
  >({})
  const [entries, setEntries] = useState<ReviewPanel.Value<'entries'>>({})
  const [users, setUsers] = useScopeValue<ReviewPanel.Value<'users'>>('users')
  const [resolvedComments, setResolvedComments] = useState<
    ReviewPanel.Value<'resolvedComments'>
  >({})

  const [shouldCollapse, setShouldCollapse] =
    useState<ReviewPanel.Value<'shouldCollapse'>>(true)
  const [lineHeight, setLineHeight] =
    useState<ReviewPanel.Value<'lineHeight'>>(0)

  const [formattedProjectMembers, setFormattedProjectMembers] = useState<
    ReviewPanel.Value<'formattedProjectMembers'>
  >({})
  const [trackChangesState, setTrackChangesState] = useState<
    ReviewPanel.Value<'trackChangesState'>
  >({})
  const [trackChangesOnForEveryone, setTrackChangesOnForEveryone] =
    useState<ReviewPanel.Value<'trackChangesOnForEveryone'>>(false)
  const [trackChangesOnForGuests, setTrackChangesOnForGuests] =
    useState<ReviewPanel.Value<'trackChangesOnForGuests'>>(false)
  const [trackChangesForGuestsAvailable, setTrackChangesForGuestsAvailable] =
    useState<ReviewPanel.Value<'trackChangesForGuestsAvailable'>>(false)

  const [resolvedThreadIds, setResolvedThreadIds] = useState<
    Record<ThreadId, boolean>
  >({})

  const [loadingThreads, setLoadingThreads] =
    useScopeValue<boolean>('loadingThreads')

  const loadThreadsController = useAbortController()
  const threadsLoadedOnceRef = useRef(false)
  const loadingThreadsInProgressRef = useRef(false)
  const ensureThreadsAreLoaded = useCallback(() => {
    if (threadsLoadedOnceRef.current) {
      // We get any updates in real time so only need to load them once.
      return
    }
    threadsLoadedOnceRef.current = true
    loadingThreadsInProgressRef.current = true

    return getJSON(`/project/${projectId}/threads`, {
      signal: loadThreadsController.signal,
    })
      .then(threads => {
        setLoadingThreads(false)
        const tempResolvedThreadIds: typeof resolvedThreadIds = {}
        const threadsEntries = Object.entries(threads) as [
          [
            ThreadId,
            MergeAndOverride<
              ReviewPanelCommentThread,
              ReviewPanelCommentThreadsApi[ThreadId]
            >,
          ],
        ]
        for (const [threadId, thread] of threadsEntries) {
          for (const comment of thread.messages) {
            formatComment(comment)
          }
          if (thread.resolved_by_user) {
            thread.resolved_by_user = formatUser(thread.resolved_by_user)
            tempResolvedThreadIds[threadId] = true
          }
        }
        setResolvedThreadIds(tempResolvedThreadIds)
        setCommentThreads(threads as unknown as ReviewPanelCommentThreads)

        dispatchReviewPanelEvent('loaded_threads')
        handleLayoutChange({ async: true })

        return {
          resolvedThreadIds: tempResolvedThreadIds,
          commentThreads: threads,
        }
      })
      .catch(debugConsole.error)
      .finally(() => {
        loadingThreadsInProgressRef.current = false
      })
  }, [loadThreadsController.signal, projectId, setLoadingThreads])

  const rangesTrackers = useRef<
    Record<DocId, RangesTrackerWithResolvedThreadIds>
  >({})
  const refreshingRangeUsers = useRef(false)
  const refreshedForUserIds = useRef(new Set<UserId>())
  const refreshChangeUsers = useCallback(
    (userId: UserId | null) => {
      if (userId != null) {
        if (refreshedForUserIds.current.has(userId)) {
          // We've already tried to refresh to get this user id, so stop it looping
          return
        }
        refreshedForUserIds.current.add(userId)
      }

      // Only do one refresh at once
      if (refreshingRangeUsers.current) {
        return
      }
      refreshingRangeUsers.current = true

      getJSON(`/project/${projectId}/changes/users`)
        .then(usersResponse => {
          refreshingRangeUsers.current = false
          const tempUsers = {} as ReviewPanel.Value<'users'>
          // Always include ourself, since if we submit an op, we might need to display info
          // about it locally before it has been flushed through the server
          if (user?.id) {
            tempUsers[user.id] = formatUser(user)
          }

          for (const user of usersResponse) {
            if (user.id) {
              tempUsers[user.id] = formatUser(user)
            }
          }

          setUsers(tempUsers)
        })
        .catch(error => {
          refreshingRangeUsers.current = false
          debugConsole.error(error)
        })
    },
    [projectId, setUsers, user]
  )

  const getChangeTracker = useCallback(
    (docId: DocId) => {
      if (!rangesTrackers.current[docId]) {
        const rangesTracker = new RangesTracker([], [])
        ;(
          rangesTracker as RangesTrackerWithResolvedThreadIds
        ).resolvedThreadIds = { ...resolvedThreadIds }
        rangesTrackers.current[docId] =
          rangesTracker as RangesTrackerWithResolvedThreadIds
      }
      return rangesTrackers.current[docId]!
    },
    [resolvedThreadIds]
  )

  const getDocEntries = useCallback(
    (docId: DocId) => {
      return entries[docId] ?? ({} as ReviewPanelDocEntries)
    },
    [entries]
  )

  const getDocResolvedComments = useCallback(
    (docId: DocId) => {
      return resolvedComments[docId] ?? ({} as ReviewPanelDocEntries)
    },
    [resolvedComments]
  )

  const getThread = useCallback(
    (threadId: ThreadId) => {
      return (
        commentThreads[threadId] ??
        ({ messages: [] } as ReviewPanelCommentThread)
      )
    },
    [commentThreads]
  )

  const updateEntries = useCallback(
    async (docId: DocId) => {
      const rangesTracker = getChangeTracker(docId)
      const docEntries = cloneDeep(getDocEntries(docId))
      const docResolvedComments = cloneDeep(getDocResolvedComments(docId))
      // Assume we'll delete everything until we see it, then we'll remove it from this object
      const deleteChanges = new Set<keyof ReviewPanelDocEntries>()

      for (const [id, change] of Object.entries(docEntries) as Entries<
        typeof docEntries
      >) {
        if (
          'entry_ids' in change &&
          id !== 'add-comment' &&
          id !== 'bulk-actions'
        ) {
          for (const entryId of change.entry_ids) {
            deleteChanges.add(entryId)
          }
        }
      }
      for (const [, change] of Object.entries(docResolvedComments) as Entries<
        typeof docResolvedComments
      >) {
        if ('entry_ids' in change) {
          for (const entryId of change.entry_ids) {
            deleteChanges.add(entryId)
          }
        }
      }

      let potentialAggregate = false
      let prevInsertion = null

      for (const change of rangesTracker.changes as any[]) {
        if (
          potentialAggregate &&
          change.op.d &&
          change.op.p === prevInsertion.op.p + prevInsertion.op.i.length &&
          change.metadata.user_id === prevInsertion.metadata.user_id
        ) {
          // An actual aggregate op.
          const aggregateChangeEntries = docEntries as Record<
            string,
            ReviewPanelAggregateChangeEntry
          >
          aggregateChangeEntries[prevInsertion.id].type = 'aggregate-change'
          aggregateChangeEntries[prevInsertion.id].metadata.replaced_content =
            change.op.d
          aggregateChangeEntries[prevInsertion.id].entry_ids.push(change.id)
        } else {
          if (docEntries[change.id] == null) {
            docEntries[change.id] = {} as ReviewPanelEntry
          }
          deleteChanges.delete(change.id)
          const newEntry: Partial<ReviewPanelChangeEntry> = {
            type: change.op.i ? 'insert' : 'delete',
            entry_ids: [change.id],
            content: change.op.i || change.op.d,
            offset: change.op.p,
            metadata: change.metadata,
          }
          for (const [key, value] of Object.entries(newEntry) as Entries<
            typeof newEntry
          >) {
            const entriesTyped = docEntries[change.id] as Record<any, any>
            entriesTyped[key] = value
          }
        }

        if (change.op.i) {
          potentialAggregate = true
          prevInsertion = change
        } else {
          potentialAggregate = false
          prevInsertion = null
        }

        if (!users[change.metadata.user_id]) {
          if (!isRestrictedTokenMember) {
            refreshChangeUsers(change.metadata.user_id)
          }
        }
      }

      let localResolvedThreadIds = resolvedThreadIds

      if (!isRestrictedTokenMember && rangesTracker.comments.length > 0) {
        const threadsLoadResult = await ensureThreadsAreLoaded()
        if (threadsLoadResult?.resolvedThreadIds) {
          localResolvedThreadIds = threadsLoadResult.resolvedThreadIds
        }
      } else if (loadingThreads) {
        // ensure that tracked changes are highlighted even if no comments are loaded
        setLoadingThreads(false)
        dispatchReviewPanelEvent('loaded_threads')
      }

      if (!loadingThreadsInProgressRef.current) {
        for (const comment of rangesTracker.comments) {
          const commentId = comment.id as ThreadId
          deleteChanges.delete(commentId)

          let newComment: any
          if (localResolvedThreadIds[comment.op.t]) {
            docResolvedComments[commentId] ??= {} as ReviewPanelCommentEntry
            newComment = docResolvedComments[commentId]
            delete docEntries[commentId]
          } else {
            docEntries[commentId] ??= {} as ReviewPanelEntry
            newComment = docEntries[commentId]
            delete docResolvedComments[commentId]
          }

          newComment.type = 'comment'
          newComment.thread_id = comment.op.t
          newComment.entry_ids = [comment.id]
          newComment.content = comment.op.c
          newComment.offset = comment.op.p
        }
      }

      deleteChanges.forEach(changeId => {
        delete docEntries[changeId]
        delete docResolvedComments[changeId]
      })

      setEntries(prev => {
        return isEqual(prev[docId], docEntries)
          ? prev
          : { ...prev, [docId]: docEntries }
      })
      setResolvedComments(prev => {
        return isEqual(prev[docId], docResolvedComments)
          ? prev
          : { ...prev, [docId]: docResolvedComments }
      })

      return docEntries
    },
    [
      getChangeTracker,
      getDocEntries,
      getDocResolvedComments,
      refreshChangeUsers,
      resolvedThreadIds,
      users,
      ensureThreadsAreLoaded,
      loadingThreads,
      setLoadingThreads,
      isRestrictedTokenMember,
    ]
  )

  const regenerateTrackChangesId = useCallback(
    (doc: typeof currentDocument) => {
      if (doc) {
        const currentChangeTracker = getChangeTracker(doc.doc_id as DocId)
        const oldId = currentChangeTracker.getIdSeed()
        const newId = RangesTracker.generateIdSeed()
        currentChangeTracker.setIdSeed(newId)
        doc.setTrackChangesIdSeeds({ pending: newId, inflight: oldId })
      }
    },
    [getChangeTracker]
  )

  useEffect(() => {
    if (!currentDocument) {
      return
    }
    // The open doc range tracker is kept up to date in real-time so
    // replace any outdated info with this
    const rangesTracker = currentDocument.ranges!
    ;(rangesTracker as RangesTrackerWithResolvedThreadIds).resolvedThreadIds = {
      ...resolvedThreadIds,
    }
    rangesTrackers.current[currentDocument.doc_id as DocId] =
      rangesTracker as RangesTrackerWithResolvedThreadIds
    currentDocument.on('flipped_pending_to_inflight', () =>
      regenerateTrackChangesId(currentDocument)
    )
    regenerateTrackChangesId(currentDocument)

    return () => {
      currentDocument.off('flipped_pending_to_inflight')
    }
  }, [currentDocument, regenerateTrackChangesId, resolvedThreadIds])

  const currentUserType = useCallback((): 'member' | 'guest' | 'anonymous' => {
    if (!user) {
      return 'anonymous'
    }
    if (project.owner._id === user.id) {
      return 'member'
    }
    for (const member of project.members as any[]) {
      if (member._id === user.id) {
        return 'member'
      }
    }
    return 'guest'
  }, [project.members, project.owner, user])

  const applyClientTrackChangesStateToServer = useCallback(
    (
      trackChangesOnForEveryone: boolean,
      trackChangesOnForGuests: boolean,
      trackChangesState: ReviewPanel.Value<'trackChangesState'>
    ) => {
      const data: {
        on?: boolean
        on_for?: Record<UserId, boolean>
        on_for_guests?: boolean
      } = {}
      if (trackChangesOnForEveryone) {
        data.on = true
      } else {
        data.on_for = {}
        const entries = Object.entries(trackChangesState) as Array<
          [
            UserId,
            NonNullable<
              (typeof trackChangesState)[keyof typeof trackChangesState]
            >,
          ]
        >
        for (const [userId, { value }] of entries) {
          data.on_for[userId] = value
        }
        if (trackChangesOnForGuests) {
          data.on_for_guests = true
        }
      }
      postJSON(`/project/${projectId}/track_changes`, {
        body: data,
      }).catch(debugConsole.error)
    },
    [projectId]
  )

  const setGuestsTCState = useCallback(
    (newValue: boolean) => {
      setTrackChangesOnForGuests(newValue)
      if (currentUserType() === 'guest' || currentUserType() === 'anonymous') {
        setWantTrackChanges(newValue)
      }
    },
    [currentUserType, setWantTrackChanges]
  )

  const setUserTCState = useCallback(
    (
      trackChangesState: DeepReadonly<ReviewPanel.Value<'trackChangesState'>>,
      userId: UserId,
      newValue: boolean,
      isLocal = false
    ) => {
      const newTrackChangesState: ReviewPanel.Value<'trackChangesState'> = {
        ...trackChangesState,
      }
      const state =
        newTrackChangesState[userId] ??
        ({} as NonNullable<(typeof newTrackChangesState)[UserId]>)
      newTrackChangesState[userId] = state

      if (state.syncState == null || state.syncState === 'synced') {
        state.value = newValue
        state.syncState = 'synced'
      } else if (state.syncState === 'pending' && state.value === newValue) {
        state.syncState = 'synced'
      } else if (isLocal) {
        state.value = newValue
        state.syncState = 'pending'
      }

      setTrackChangesState(newTrackChangesState)

      if (userId === user.id) {
        setWantTrackChanges(newValue)
      }

      return newTrackChangesState
    },
    [setWantTrackChanges, user.id]
  )

  const setEveryoneTCState = useCallback(
    (newValue: boolean, isLocal = false) => {
      setTrackChangesOnForEveryone(newValue)
      let newTrackChangesState: ReviewPanel.Value<'trackChangesState'> = {
        ...trackChangesState,
      }
      for (const member of project.members as any[]) {
        newTrackChangesState = setUserTCState(
          newTrackChangesState,
          member._id,
          newValue,
          isLocal
        )
      }
      setGuestsTCState(newValue)

      newTrackChangesState = setUserTCState(
        newTrackChangesState,
        project.owner._id,
        newValue,
        isLocal
      )

      return { trackChangesState: newTrackChangesState }
    },
    [
      project.members,
      project.owner._id,
      setGuestsTCState,
      setUserTCState,
      trackChangesState,
    ]
  )

  const toggleTrackChangesForEveryone = useCallback<
    ReviewPanel.UpdaterFn<'toggleTrackChangesForEveryone'>
  >(
    (onForEveryone: boolean) => {
      const { trackChangesState } = setEveryoneTCState(onForEveryone, true)
      setGuestsTCState(onForEveryone)
      applyClientTrackChangesStateToServer(
        onForEveryone,
        onForEveryone,
        trackChangesState
      )
    },
    [applyClientTrackChangesStateToServer, setEveryoneTCState, setGuestsTCState]
  )

  const toggleTrackChangesForGuests = useCallback<
    ReviewPanel.UpdaterFn<'toggleTrackChangesForGuests'>
  >(
    (onForGuests: boolean) => {
      setGuestsTCState(onForGuests)
      applyClientTrackChangesStateToServer(
        trackChangesOnForEveryone,
        onForGuests,
        trackChangesState
      )
    },
    [
      applyClientTrackChangesStateToServer,
      setGuestsTCState,
      trackChangesOnForEveryone,
      trackChangesState,
    ]
  )

  const toggleTrackChangesForUser = useCallback<
    ReviewPanel.UpdaterFn<'toggleTrackChangesForUser'>
  >(
    (onForUser: boolean, userId: UserId) => {
      const newTrackChangesState = setUserTCState(
        trackChangesState,
        userId,
        onForUser,
        true
      )
      applyClientTrackChangesStateToServer(
        trackChangesOnForEveryone,
        trackChangesOnForGuests,
        newTrackChangesState
      )
    },
    [
      applyClientTrackChangesStateToServer,
      setUserTCState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesState,
    ]
  )

  const applyTrackChangesStateToClient = useCallback(
    (state: boolean | Record<UserId | '__guests__', boolean>) => {
      if (typeof state === 'boolean') {
        setEveryoneTCState(state)
        setGuestsTCState(state)
      } else {
        setTrackChangesOnForEveryone(false)
        // TODO
        // @ts-ignore
        setGuestsTCState(state.__guests__ === true)

        let newTrackChangesState: ReviewPanel.Value<'trackChangesState'> = {
          ...trackChangesState,
        }
        for (const member of project.members as any[]) {
          newTrackChangesState = setUserTCState(
            newTrackChangesState,
            member._id,
            !!state[member._id]
          )
        }
        newTrackChangesState = setUserTCState(
          newTrackChangesState,
          project.owner._id,
          !!state[project.owner._id]
        )
        return newTrackChangesState
      }
    },
    [
      project.members,
      project.owner._id,
      setEveryoneTCState,
      setGuestsTCState,
      setUserTCState,
      trackChangesState,
    ]
  )

  const setGuestFeatureBasedOnProjectAccessLevel = (
    projectPublicAccessLevel?: PublicAccessLevel
  ) => {
    setTrackChangesForGuestsAvailable(projectPublicAccessLevel === 'tokenBased')
  }

  useEffect(() => {
    setGuestFeatureBasedOnProjectAccessLevel(project.publicAccessLevel)
  }, [project.publicAccessLevel])

  useEffect(() => {
    if (
      trackChangesForGuestsAvailable ||
      !trackChangesOnForGuests ||
      trackChangesOnForEveryone
    ) {
      return
    }

    // Overrides guest setting
    toggleTrackChangesForGuests(false)
  }, [
    toggleTrackChangesForGuests,
    trackChangesForGuestsAvailable,
    trackChangesOnForEveryone,
    trackChangesOnForGuests,
  ])

  const projectJoinedEffectExecuted = useRef(false)
  useEffect(() => {
    if (!projectJoinedEffectExecuted.current) {
      projectJoinedEffectExecuted.current = true
      requestAnimationFrame(() => {
        if (trackChanges) {
          applyTrackChangesStateToClient(project.trackChangesState)
        } else {
          applyTrackChangesStateToClient(false)
        }
        setGuestFeatureBasedOnProjectAccessLevel(project.publicAccessLevel)
      })
    }
  }, [
    applyTrackChangesStateToClient,
    trackChanges,
    project.publicAccessLevel,
    project.trackChangesState,
  ])

  useEffect(() => {
    setFormattedProjectMembers(prevState => {
      const tempFormattedProjectMembers: typeof prevState = {}
      if (project.owner) {
        tempFormattedProjectMembers[project.owner._id] = formatUser(
          project.owner
        )
      }
      const members = project.members ?? []
      for (const member of members) {
        if (member.privileges === 'readAndWrite') {
          if (!trackChangesState[member._id]) {
            // An added member will have track changes enabled if track changes is on for everyone
            setUserTCState(
              trackChangesState,
              member._id,
              trackChangesOnForEveryone,
              true
            )
          }
          tempFormattedProjectMembers[member._id] = formatUser(member)
        }
      }
      return tempFormattedProjectMembers
    })
  }, [
    project.members,
    project.owner,
    setUserTCState,
    trackChangesOnForEveryone,
    trackChangesState,
  ])

  useSocketListener(
    socket,
    'toggle-track-changes',
    applyTrackChangesStateToClient
  )

  const gotoEntry = useCallback(
    (docId: DocId, entryOffset: number) => {
      openDocWithId(docId, { gotoOffset: entryOffset })
    },
    [openDocWithId]
  )

  const view = reviewPanelOpen ? subView : 'mini'

  const toggleReviewPanel = useCallback(() => {
    if (!trackChangesVisible) {
      return
    }
    setReviewPanelOpen(!reviewPanelOpen)
    sendMB('rp-toggle-panel', {
      value: !reviewPanelOpen,
    })
  }, [reviewPanelOpen, setReviewPanelOpen, trackChangesVisible])

  const onCommentResolved = useCallback(
    (threadId: ThreadId, user: any) => {
      setCommentThreads(prevState => {
        const thread = { ...getThread(threadId) }
        thread.resolved = true
        thread.resolved_by_user = formatUser(user)
        thread.resolved_at = new Date().toISOString() as DateString
        return { ...prevState, [threadId]: thread }
      })
      setResolvedThreadIds(prevState => ({ ...prevState, [threadId]: true }))
      setTimeout(() => {
        dispatchReviewPanelEvent('comment:resolve_threads', [threadId])
      })
    },
    [getThread]
  )

  const resolveComment = useCallback(
    (docId: DocId, entryId: ThreadId) => {
      const docEntries = getDocEntries(docId)
      const entry = docEntries[entryId] as ReviewPanelCommentEntry

      setEntries(prevState => ({
        ...prevState,
        [docId]: {
          ...prevState[docId],
          [entryId]: {
            ...prevState[docId][entryId],
            focused: false,
          },
        },
      }))

      postJSON(
        `/project/${projectId}/doc/${docId}/thread/${entry.thread_id}/resolve`
      )
      onCommentResolved(entry.thread_id, user)
      sendMB('rp-comment-resolve', { view })
    },
    [getDocEntries, onCommentResolved, projectId, user, view]
  )

  const onCommentReopened = useCallback(
    (threadId: ThreadId) => {
      setCommentThreads(prevState => {
        const {
          resolved: _1,
          resolved_by_user: _2,
          resolved_at: _3,
          ...thread
        } = getThread(threadId)
        return { ...prevState, [threadId]: thread }
      })
      setResolvedThreadIds(({ [threadId]: _, ...resolvedThreadIds }) => {
        return resolvedThreadIds
      })
      setTimeout(() => {
        dispatchReviewPanelEvent('comment:unresolve_thread', threadId)
      })
    },
    [getThread]
  )

  const unresolveComment = useCallback(
    (docId: DocId, threadId: ThreadId) => {
      onCommentReopened(threadId)
      const url = `/project/${projectId}/doc/${docId}/thread/${threadId}/reopen`
      postJSON(url).catch(debugConsole.error)
      sendMB('rp-comment-reopen')
    },
    [onCommentReopened, projectId]
  )

  const onThreadDeleted = useCallback((threadId: ThreadId) => {
    setResolvedThreadIds(({ [threadId]: _, ...resolvedThreadIds }) => {
      return resolvedThreadIds
    })
    setCommentThreads(({ [threadId]: _, ...commentThreads }) => {
      return commentThreads
    })
    dispatchReviewPanelEvent('comment:remove', threadId)
  }, [])

  const deleteThread = useCallback(
    (docId: DocId, threadId: ThreadId) => {
      onThreadDeleted(threadId)
      deleteJSON(`/project/${projectId}/doc/${docId}/thread/${threadId}`).catch(
        debugConsole.error
      )
      sendMB('rp-comment-delete')
    },
    [onThreadDeleted, projectId]
  )

  const onCommentEdited = useCallback(
    (threadId: ThreadId, commentId: CommentId, content: string) => {
      setCommentThreads(prevState => {
        const thread = { ...getThread(threadId) }
        thread.messages = thread.messages.map(message => {
          return message.id === commentId ? { ...message, content } : message
        })
        return { ...prevState, [threadId]: thread }
      })
    },
    [getThread]
  )

  const saveEdit = useCallback(
    (threadId: ThreadId, commentId: CommentId, content: string) => {
      const url = `/project/${projectId}/thread/${threadId}/messages/${commentId}/edit`
      postJSON(url, { body: { content } }).catch(debugConsole.error)
      handleLayoutChange({ async: true })
    },
    [projectId]
  )

  const onCommentDeleted = useCallback(
    (threadId: ThreadId, commentId: CommentId) => {
      setCommentThreads(prevState => {
        const thread = { ...getThread(threadId) }
        thread.messages = thread.messages.filter(m => m.id !== commentId)
        return { ...prevState, [threadId]: thread }
      })
    },
    [getThread]
  )

  const deleteComment = useCallback(
    (threadId: ThreadId, commentId: CommentId) => {
      onCommentDeleted(threadId, commentId)
      deleteJSON(
        `/project/${projectId}/thread/${threadId}/messages/${commentId}`
      ).catch(debugConsole.error)
      handleLayoutChange({ async: true })
    },
    [onCommentDeleted, projectId]
  )

  const doAcceptChanges = useCallback(
    (entryIds: ThreadId[]) => {
      const url = `/project/${projectId}/doc/${currentDocumentId}/changes/accept`
      postJSON(url, { body: { change_ids: entryIds } }).catch(
        debugConsole.error
      )
      dispatchReviewPanelEvent('changes:accept', entryIds)
    },
    [currentDocumentId, projectId]
  )

  const acceptChanges = useCallback(
    (entryIds: ThreadId[]) => {
      doAcceptChanges(entryIds)
      sendMB('rp-changes-accepted', { view })
    },
    [doAcceptChanges, view]
  )

  const doRejectChanges = useCallback((entryIds: ThreadId[]) => {
    dispatchReviewPanelEvent('changes:reject', entryIds)
  }, [])

  const rejectChanges = useCallback(
    (entryIds: ThreadId[]) => {
      doRejectChanges(entryIds)
      sendMB('rp-changes-rejected', { view })
    },
    [doRejectChanges, view]
  )

  const bulkAcceptActions = useCallback(() => {
    doAcceptChanges(selectedEntryIds.current)
    sendMB('rp-bulk-accept', { view, nEntries: nVisibleSelectedChanges })
  }, [doAcceptChanges, nVisibleSelectedChanges, view])

  const bulkRejectActions = useCallback(() => {
    doRejectChanges(selectedEntryIds.current)
    sendMB('rp-bulk-reject', { view, nEntries: nVisibleSelectedChanges })
  }, [doRejectChanges, nVisibleSelectedChanges, view])

  const refreshRanges = useCallback(() => {
    type Doc = {
      id: DocId
      ranges: {
        comments?: Change<CommentOperation>[]
        changes?: Change<EditOperation>[]
      }
    }

    return getJSON<Doc[]>(`/project/${projectId}/ranges`)
      .then(docs => {
        setCollapsed(prevState => {
          const collapsed = { ...prevState }
          docs.forEach(doc => {
            if (collapsed[doc.id] == null) {
              collapsed[doc.id] = false
            }
          })
          return collapsed
        })

        docs.forEach(async doc => {
          if (doc.id !== currentDocumentId) {
            // this is kept up to date in real-time, don't overwrite
            const rangesTracker = getChangeTracker(doc.id)
            rangesTracker.comments = doc.ranges?.comments ?? []
            rangesTracker.changes = doc.ranges?.changes ?? []
          }
        })

        return Promise.all(docs.map(doc => updateEntries(doc.id)))
      })
      .catch(debugConsole.error)
  }, [
    currentDocumentId,
    getChangeTracker,
    projectId,
    setCollapsed,
    updateEntries,
  ])

  const handleSetSubview = useCallback((subView: SubView) => {
    setSubView(subView)
    sendMB('rp-subview-change', { subView })
  }, [])

  const submitReply = useCallback(
    (threadId: ThreadId, replyContent: string) => {
      const url = `/project/${projectId}/thread/${threadId}/messages`
      postJSON(url, { body: { content: replyContent } }).catch(() => {
        showGenericMessageModal(
          t('error_submitting_comment'),
          t('comment_submit_error')
        )
      })

      const trackingMetadata = {
        view,
        size: replyContent.length,
        thread: threadId,
      }

      setCommentThreads(prevState => ({
        ...prevState,
        [threadId]: { ...getThread(threadId), submitting: true },
      }))
      handleLayoutChange({ async: true })
      sendMB('rp-comment-reply', trackingMetadata)
    },
    [getThread, projectId, showGenericMessageModal, t, view]
  )

  // TODO `submitNewComment` is partially localized in the `add-comment-entry` component.
  const submitNewComment = useCallback(
    (content: string) => {
      if (!content) {
        return
      }

      const entries = getDocEntries(currentDocumentId)
      const addCommentEntry = entries['add-comment'] as
        | ReviewPanelAddCommentEntry
        | undefined

      if (!addCommentEntry) {
        return
      }

      const { offset, length } = addCommentEntry
      const threadId = RangesTracker.generateId() as ThreadId
      setCommentThreads(prevState => ({
        ...prevState,
        [threadId]: { ...getThread(threadId), submitting: true },
      }))

      const url = `/project/${projectId}/thread/${threadId}/messages`
      postJSON(url, { body: { content } })
        .then(() => {
          dispatchReviewPanelEvent('comment:add', { threadId, offset, length })
          handleLayoutChange({ async: true })
          sendMB('rp-new-comment', { size: content.length })
        })
        .catch(() => {
          showGenericMessageModal(
            t('error_submitting_comment'),
            t('comment_submit_error')
          )
        })
    },
    [
      currentDocumentId,
      getDocEntries,
      getThread,
      projectId,
      showGenericMessageModal,
      t,
    ]
  )

  const [isAddingComment, setIsAddingComment] = useState(false)
  const [navHeight, setNavHeight] = useState(0)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [layoutSuspended, setLayoutSuspended] = useState(false)
  const [unsavedComment, setUnsavedComment] = useState('')

  useEffect(() => {
    if (!trackChangesVisible) {
      setReviewPanelOpen(false)
    }
  }, [trackChangesVisible, setReviewPanelOpen])

  const hasEntries = useMemo(() => {
    const docEntries = getDocEntries(currentDocumentId)
    const permEntriesCount = Object.keys(docEntries).filter(key => {
      return !['add-comment', 'bulk-actions'].includes(key)
    }).length
    return permEntriesCount > 0 && trackChangesVisible
  }, [currentDocumentId, getDocEntries, trackChangesVisible])

  useEffect(() => {
    setMiniReviewPanelVisible(!reviewPanelOpen && !!hasEntries)
  }, [reviewPanelOpen, hasEntries, setMiniReviewPanelVisible])

  // listen for events from the CodeMirror 6 track changes extension
  useEffect(() => {
    const toggleTrackChangesFromKbdShortcut = () => {
      const userId = user.id
      if (trackChangesVisible && trackChanges && userId) {
        const state = trackChangesState[userId]
        if (state) {
          toggleTrackChangesForUser(!state.value, userId)
        }
      }
    }

    const editorLineHeightChanged = (payload: typeof lineHeight) => {
      setLineHeight(payload)
      handleLayoutChange()
    }

    const editorTrackChangesChanged = async () => {
      const tempEntries = cloneDeep(await updateEntries(currentDocumentId))

      // `tempEntries` would be mutated
      dispatchReviewPanelEvent('recalculate-screen-positions', {
        entries: tempEntries,
        updateType: 'trackedChangesChange',
      })

      // The state should be updated after dispatching the 'recalculate-screen-positions'
      // event as `tempEntries` will be mutated
      setEntries(prev => ({ ...prev, [currentDocumentId]: tempEntries }))
      handleLayoutChange()
    }

    const editorTrackChangesVisibilityChanged = () => {
      handleLayoutChange({ async: true, animate: false })
    }

    const editorFocusChanged = (
      selectionOffsetStart: number,
      selectionOffsetEnd: number,
      selection: boolean,
      updateType: UpdateType
    ) => {
      let tempEntries = cloneDeep(getDocEntries(currentDocumentId))
      // All selected changes will be added to this array.
      selectedEntryIds.current = []
      // Count of user-visible changes, i.e. an aggregated change will count as one.
      let tempNVisibleSelectedChanges = 0

      const offset = selectionOffsetStart
      const length = selectionOffsetEnd - selectionOffsetStart

      // Recreate the add comment and bulk actions entries only when
      // necessary. This is to avoid the UI thinking that these entries have
      // changed and getting into an infinite loop.
      if (selection) {
        const existingAddComment = tempEntries[
          'add-comment'
        ] as ReviewPanelAddCommentEntry
        if (
          !existingAddComment ||
          existingAddComment.offset !== offset ||
          existingAddComment.length !== length
        ) {
          tempEntries['add-comment'] = {
            type: 'add-comment',
            offset,
            length,
          } as ReviewPanelAddCommentEntry
        }
        const existingBulkActions = tempEntries[
          'bulk-actions'
        ] as ReviewPanelBulkActionsEntry
        if (
          !existingBulkActions ||
          existingBulkActions.offset !== offset ||
          existingBulkActions.length !== length
        ) {
          tempEntries['bulk-actions'] = {
            type: 'bulk-actions',
            offset,
            length,
          } as ReviewPanelBulkActionsEntry
        }
      } else {
        delete (tempEntries as Partial<typeof tempEntries>)['add-comment']
        delete (tempEntries as Partial<typeof tempEntries>)['bulk-actions']
      }

      for (const [key, entry] of Object.entries(tempEntries) as Entries<
        typeof tempEntries
      >) {
        let isChangeEntryAndWithinSelection = false
        if (entry.type === 'comment' && !resolvedThreadIds[entry.thread_id]) {
          tempEntries = {
            ...tempEntries,
            [key]: {
              ...tempEntries[key],
              focused:
                entry.offset <= selectionOffsetStart &&
                selectionOffsetStart <= entry.offset + entry.content.length,
            },
          }
        } else if (
          entry.type === 'insert' ||
          entry.type === 'aggregate-change'
        ) {
          isChangeEntryAndWithinSelection =
            entry.offset >= selectionOffsetStart &&
            entry.offset + entry.content.length <= selectionOffsetEnd
          tempEntries = {
            ...tempEntries,
            [key]: {
              ...tempEntries[key],
              focused:
                entry.offset <= selectionOffsetStart &&
                selectionOffsetStart <= entry.offset + entry.content.length,
            },
          }
        } else if (entry.type === 'delete') {
          isChangeEntryAndWithinSelection =
            selectionOffsetStart <= entry.offset &&
            entry.offset <= selectionOffsetEnd
          tempEntries = {
            ...tempEntries,
            [key]: {
              ...tempEntries[key],
              focused: entry.offset === selectionOffsetStart,
            },
          }
        } else if (
          ['add-comment', 'bulk-actions'].includes(entry.type) &&
          selection
        ) {
          tempEntries = {
            ...tempEntries,
            [key]: { ...tempEntries[key], focused: true },
          }
        }
        if (isChangeEntryAndWithinSelection) {
          const entryIds = 'entry_ids' in entry ? entry.entry_ids : []
          for (const entryId of entryIds) {
            selectedEntryIds.current.push(entryId)
          }
          tempNVisibleSelectedChanges++
        }
      }

      // `tempEntries` would be mutated
      dispatchReviewPanelEvent('recalculate-screen-positions', {
        entries: tempEntries,
        updateType,
      })

      // The state should be updated after dispatching the 'recalculate-screen-positions'
      // event as `tempEntries` will be mutated
      setEntries(prev => ({ ...prev, [currentDocumentId]: tempEntries }))
      setNVisibleSelectedChanges(tempNVisibleSelectedChanges)

      handleLayoutChange()
    }

    const addNewCommentFromKbdShortcut = () => {
      if (!trackChangesVisible) {
        return
      }
      dispatchReviewPanelEvent('comment:select_line')

      if (!reviewPanelOpen) {
        toggleReviewPanel()
      }
      handleLayoutChange({ async: true })
      addCommentEmitter()
    }

    const handleEditorEvents = (e: Event) => {
      const event = e as CustomEvent
      const { type, payload } = event.detail

      switch (type) {
        case 'line-height': {
          editorLineHeightChanged(payload)
          break
        }

        case 'track-changes:changed': {
          editorTrackChangesChanged()
          break
        }

        case 'track-changes:visibility_changed': {
          editorTrackChangesVisibilityChanged()
          break
        }

        case 'focus:changed': {
          const { from, to, empty, updateType } = payload
          editorFocusChanged(from, to, !empty, updateType)
          break
        }

        case 'add-new-comment': {
          addNewCommentFromKbdShortcut()
          break
        }

        case 'toggle-track-changes': {
          toggleTrackChangesFromKbdShortcut()
          break
        }

        case 'toggle-review-panel': {
          toggleReviewPanel()
          break
        }
      }
    }

    window.addEventListener('editor:event', handleEditorEvents)

    return () => {
      window.removeEventListener('editor:event', handleEditorEvents)
    }
  }, [
    addCommentEmitter,
    currentDocumentId,
    getDocEntries,
    resolvedThreadIds,
    reviewPanelOpen,
    toggleReviewPanel,
    toggleTrackChangesForUser,
    trackChanges,
    trackChangesState,
    trackChangesVisible,
    updateEntries,
    user.id,
  ])

  useSocketListener(socket, 'reopen-thread', onCommentReopened)
  useSocketListener(socket, 'delete-thread', onThreadDeleted)
  useSocketListener(socket, 'resolve-thread', onCommentResolved)
  useSocketListener(socket, 'edit-message', onCommentEdited)
  useSocketListener(socket, 'delete-message', onCommentDeleted)
  useSocketListener(
    socket,
    'accept-changes',
    useCallback(
      (docId: DocId, entryIds: ThreadId[]) => {
        if (docId !== currentDocumentId) {
          getChangeTracker(docId).removeChangeIds(entryIds)
        } else {
          dispatchReviewPanelEvent('changes:accept', entryIds)
        }
        updateEntries(docId)
      },
      [currentDocumentId, getChangeTracker, updateEntries]
    )
  )
  useSocketListener(
    socket,
    'new-comment',
    useCallback(
      (threadId: ThreadId, comment: ReviewPanelCommentThreadMessageApi) => {
        setCommentThreads(prevState => {
          const { submitting: _, ...thread } = getThread(threadId)
          thread.messages = [...thread.messages]
          thread.messages.push(formatComment(comment))
          return { ...prevState, [threadId]: thread }
        })
        handleLayoutChange({ async: true })
      },
      [getThread]
    )
  )
  useSocketListener(
    socket,
    'new-comment-threads',
    useCallback(
      (threads: ReviewPanelCommentThreadsApi) => {
        setCommentThreads(prevState => {
          const newThreads = { ...prevState }
          for (const threadIdString of Object.keys(threads)) {
            const threadId = threadIdString as ThreadId
            const { submitting: _, ...thread } = getThread(threadId)
            // Replace already loaded messages with the server provided ones
            thread.messages = threads[threadId].messages.map(formatComment)
            newThreads[threadId] = thread
          }
          return newThreads
        })
        handleLayoutChange({ async: true })
      },
      [getThread]
    )
  )

  const openSubView = useRef<typeof subView>('cur_file')
  useEffect(() => {
    if (!reviewPanelOpen) {
      // Always show current file when not open, but save current state
      setSubView(prevState => {
        openSubView.current = prevState
        return 'cur_file'
      })
    } else {
      // Reset back to what we had when previously open
      setSubView(openSubView.current)
    }
    handleLayoutChange({ async: true, animate: false })
  }, [reviewPanelOpen])

  const canRefreshRanges = useRef(false)
  const prevSubView = useRef(subView)
  const initializedPrevSubView = useRef(false)
  useEffect(() => {
    // Prevent setting a computed value for `prevSubView` on mount
    if (!initializedPrevSubView.current) {
      initializedPrevSubView.current = true
      return
    }
    prevSubView.current = subView === 'cur_file' ? 'overview' : 'cur_file'
    // Allow refreshing ranges once for each `subView` change
    canRefreshRanges.current = true
  }, [subView])

  useEffect(() => {
    if (subView === 'overview' && canRefreshRanges.current) {
      canRefreshRanges.current = false

      setIsOverviewLoading(true)
      refreshRanges().finally(() => {
        setIsOverviewLoading(false)
      })
    }
  }, [subView, refreshRanges])

  useEffect(() => {
    if (subView === 'cur_file' && prevSubView.current === 'overview') {
      dispatchReviewPanelEvent('overview-closed', subView)
    }
  }, [subView])

  useEffect(() => {
    if (Object.keys(users).length) {
      handleLayoutChange({ async: true })
    }
  }, [users])

  const values = useMemo<ReviewPanel.ReviewPanelState['values']>(
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
      openDocId: currentDocumentId,
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
      currentDocumentId,
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

  const updaterFns = useMemo<ReviewPanel.ReviewPanelState['updaterFns']>(
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
      refreshResolvedCommentsDropdown: refreshRanges,
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
      refreshRanges,
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

export default useReviewPanelState
