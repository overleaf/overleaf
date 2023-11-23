import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { isEqual, cloneDeep } from 'lodash'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import useAsync from '@/shared/hooks/use-async'
import useAbortController from '@/shared/hooks/use-abort-controller'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import { dispatchReviewPanelLayout as handleLayoutChange } from '@/features/source-editor/extensions/changes/change-manager'
import { useProjectContext } from '@/shared/context/project-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useUserContext } from '@/shared/context/user-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugConsole } from '@/utils/debugging'
import { useEditorContext } from '@/shared/context/editor-context'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import ColorManager from '@/ide/colors/ColorManager'
// @ts-ignore
import RangesTracker from '@overleaf/ranges-tracker'
import { ReviewPanelStateReactIde } from '../types/review-panel-state'
import * as ReviewPanel from '../types/review-panel-state'
import {
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
  MergeAndOverride,
} from '../../../../../../../types/utils'
import { ReviewPanelCommentThread } from '../../../../../../../types/review-panel/comment-thread'
import { DocId } from '../../../../../../../types/project-settings'
import {
  ReviewPanelAggregateChangeEntry,
  ReviewPanelChangeEntry,
  ReviewPanelCommentEntry,
  ReviewPanelEntry,
} from '../../../../../../../types/review-panel/entry'
import {
  ReviewPanelCommentThreadMessageApi,
  ReviewPanelCommentThreadsApi,
} from '../../../../../../../types/review-panel/api'
import { Document } from '@/features/ide-react/editor/document'

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
      hue: ColorManager.ANONYMOUS_HUE,
      avatar_text: 'A',
    }
  }
  if (id === window.user_id) {
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
    hue: ColorManager.getHueForUserId(id),
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

function useReviewPanelState(): ReviewPanelStateReactIde {
  const { reviewPanelOpen, setReviewPanelOpen } = useLayoutContext()
  const { projectId } = useIdeReactContext()
  const project = useProjectContext()
  const user = useUserContext()
  const { socket } = useConnectionContext()
  const {
    features: { trackChangesVisible, trackChanges },
  } = project
  const { isRestrictedTokenMember } = useEditorContext()

  // TODO `currentDocument` and `currentDocumentId` should be get from `useEditorManagerContext()` but that makes tests fail
  const [currentDocument] = useScopeValue<Document>('editor.sharejs_doc')
  const [currentDocumentId] = useScopeValue<DocId>('editor.open_doc_id')

  const [subView, setSubView] =
    useState<ReviewPanel.Value<'subView'>>('cur_file')
  const [loading] = useScopeValue<ReviewPanel.Value<'loading'>>(
    'reviewPanel.overview.loading'
  )
  const [nVisibleSelectedChanges] = useScopeValue<
    ReviewPanel.Value<'nVisibleSelectedChanges'>
  >('reviewPanel.nVisibleSelectedChanges')
  const [collapsed, setCollapsed] = useScopeValue<
    ReviewPanel.Value<'collapsed'>
  >('reviewPanel.overview.docsCollapsedState')
  const [commentThreads, setCommentThreads] = useState<
    ReviewPanel.Value<'commentThreads'>
  >({})
  const [entries, setEntries] = useState<ReviewPanel.Value<'entries'>>({})

  const [permissions] =
    useScopeValue<ReviewPanel.Value<'permissions'>>('permissions')
  const [users, setUsers] = useScopeValue<ReviewPanel.Value<'users'>>(
    'users',
    true
  )
  const [resolvedComments, setResolvedComments] = useState<
    ReviewPanel.Value<'resolvedComments'>
  >({})

  const [wantTrackChanges, setWantTrackChanges] = useScopeValue<
    ReviewPanel.Value<'wantTrackChanges'>
  >('editor.wantTrackChanges')
  const openDocId = currentDocumentId
  const [shouldCollapse, setShouldCollapse] =
    useState<ReviewPanel.Value<'shouldCollapse'>>(true)
  const [lineHeight] = useScopeValue<number>(
    'reviewPanel.rendererData.lineHeight'
  )

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

  const {
    isLoading: loadingThreads,
    reset,
    runAsync: runAsyncThreads,
  } = useAsync<ReviewPanelCommentThreadsApi>()
  const loadThreadsController = useAbortController()
  const loadThreadsExecuted = useRef(false)
  const ensureThreadsAreLoaded = useCallback(() => {
    if (loadThreadsExecuted.current) {
      // We get any updates in real time so only need to load them once.
      return
    }
    loadThreadsExecuted.current = true

    return runAsyncThreads(
      getJSON(`/project/${projectId}/threads`, {
        signal: loadThreadsController.signal,
      })
    )
      .then(threads => {
        const tempResolvedThreadIds: typeof resolvedThreadIds = {}
        const threadsEntries = Object.entries(threads) as [
          [
            ThreadId,
            MergeAndOverride<
              ReviewPanelCommentThread,
              ReviewPanelCommentThreadsApi[ThreadId]
            >
          ]
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
  }, [loadThreadsController.signal, projectId, runAsyncThreads])

  const rangesTrackers = useRef<Record<DocId, RangesTracker>>({})
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
          if (user) {
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
        rangesTrackers.current[docId] = new RangesTracker() as RangesTracker
        rangesTrackers.current[docId].resolvedThreadIds = {
          ...resolvedThreadIds,
        }
      }
      return rangesTrackers.current[docId]
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

  const updateEntries = useCallback(
    async (docId: DocId) => {
      const rangesTracker = getChangeTracker(docId)
      let localResolvedThreadIds = resolvedThreadIds

      if (!isRestrictedTokenMember) {
        if (rangesTracker.comments.length > 0) {
          const threadsLoadResult = await ensureThreadsAreLoaded()
          if (typeof threadsLoadResult === 'object') {
            localResolvedThreadIds = threadsLoadResult.resolvedThreadIds
          }
        } else if (loadingThreads) {
          // ensure that tracked changes are highlighted even if no comments are loaded
          reset()
          dispatchReviewPanelEvent('loaded_threads')
        }
      }

      const docEntries = cloneDeep(getDocEntries(docId))
      const docResolvedComments = cloneDeep(getDocResolvedComments(docId))
      // Assume we'll delete everything until we see it, then we'll remove it from this object
      const deleteChanges = new Set<keyof ReviewPanelDocEntries>()

      for (const [id, change] of Object.entries(docEntries)) {
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
      for (const [, change] of Object.entries(docResolvedComments)) {
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
          const newEntryEntries = Object.entries(newEntry) as [
            [keyof typeof newEntry, typeof newEntry[keyof typeof newEntry]]
          ]
          for (const [key, value] of newEntryEntries) {
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

      for (const comment of rangesTracker.comments) {
        deleteChanges.delete(comment.id)

        const newEntry: Partial<ReviewPanelCommentEntry> = {
          type: 'comment',
          thread_id: comment.op.t,
          entry_ids: [comment.id],
          content: comment.op.c,
          offset: comment.op.p,
        }
        const newEntryEntries = Object.entries(newEntry) as [
          [keyof typeof newEntry, typeof newEntry[keyof typeof newEntry]]
        ]

        let newComment: any
        if (localResolvedThreadIds[comment.op.t]) {
          docResolvedComments[comment.id] ??= {} as ReviewPanelCommentEntry
          newComment = docResolvedComments[comment.id]
          delete docEntries[comment.id]
        } else {
          docEntries[comment.id] ??= {} as ReviewPanelEntry
          newComment = docEntries[comment.id]
          delete docResolvedComments[comment.id]
        }

        for (const [key, value] of newEntryEntries) {
          newComment[key] = value
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
      isRestrictedTokenMember,
      refreshChangeUsers,
      resolvedThreadIds,
      users,
      ensureThreadsAreLoaded,
      loadingThreads,
      reset,
    ]
  )

  const regenerateTrackChangesId = useCallback(
    (doc: typeof currentDocument) => {
      const currentChangeTracker = getChangeTracker(doc.doc_id as DocId)
      const oldId = currentChangeTracker.getIdSeed()
      const newId = RangesTracker.generateIdSeed()
      currentChangeTracker.setIdSeed(newId)
      doc.setTrackChangesIdSeeds({ pending: newId, inflight: oldId })
    },
    [getChangeTracker]
  )

  useEffect(() => {
    if (!currentDocument) {
      return
    }
    // The open doc range tracker is kept up to date in real-time so
    // replace any outdated info with this
    rangesTrackers.current[currentDocument.doc_id as DocId] =
      currentDocument.ranges
    rangesTrackers.current[currentDocument.doc_id as DocId].resolvedThreadIds =
      { ...resolvedThreadIds }
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
    if (project.owner === user.id) {
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
              typeof trackChangesState[keyof typeof trackChangesState]
            >
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
        ({} as NonNullable<typeof newTrackChangesState[UserId]>)
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
    (state: boolean | Record<UserId, boolean>) => {
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
            state[member._id] ?? false
          )
        }
        newTrackChangesState = setUserTCState(
          newTrackChangesState,
          project.owner._id,
          state[project.owner._id] ?? false
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
    projectPublicAccessLevel: PublicAccessLevel
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
      if (project.members) {
        for (const member of project.members) {
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

  const toggleReviewPanel = useCallback(() => {
    if (!trackChangesVisible) {
      return
    }
    setReviewPanelOpen(value => !value)
    sendMB('rp-toggle-panel', {
      value: reviewPanelOpen,
    })
  }, [reviewPanelOpen, setReviewPanelOpen, trackChangesVisible])

  const [unresolveComment] =
    useScopeValue<ReviewPanel.UpdaterFn<'unresolveComment'>>('unresolveComment')
  const [deleteThread] =
    useScopeValue<ReviewPanel.UpdaterFn<'deleteThread'>>('deleteThread')
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

  const handleSetSubview = useCallback((subView: SubView) => {
    setSubView(subView)
    sendMB('rp-subview-change', { subView })
  }, [])

  const submitReply = useCallback(
    (threadId: ThreadId, replyContent: string) => {
      submitReplyAngular({ thread_id: threadId, replyContent })
    },
    [submitReplyAngular]
  )

  const [entryHover, setEntryHover] = useState(false)
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [navHeight, setNavHeight] = useState(0)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [layoutSuspended, setLayoutSuspended] = useState(false)
  const [unsavedComment, setUnsavedComment] = useState('')

  // listen for events from the CodeMirror 6 track changes extension
  useEffect(() => {
    const toggleTrackChangesFromKbdShortcut = () => {
      if (trackChangesVisible && trackChanges) {
        const userId: UserId = user.id
        const state = trackChangesState[userId]
        if (state) {
          toggleTrackChangesForUser(!state.value, userId)
        }
      }
    }

    const editorTrackChangesChanged = async () => {
      const entries = await updateEntries(currentDocumentId)
      dispatchReviewPanelEvent('recalculate-screen-positions', {
        entries,
        updateType: 'trackedChangesChange',
      })
      // Ensure that watchers, such as the React-based review panel component,
      // are informed of the changes to entries
      handleLayoutChange()
    }

    const handleEditorEvents = (e: Event) => {
      const event = e as CustomEvent
      const { type } = event.detail

      switch (type) {
        case 'track-changes:changed': {
          editorTrackChangesChanged()
          break
        }

        case 'toggle-track-changes': {
          toggleTrackChangesFromKbdShortcut()
          break
        }
      }
    }

    window.addEventListener('editor:event', handleEditorEvents)

    return () => {
      window.removeEventListener('editor:event', handleEditorEvents)
    }
  }, [
    currentDocumentId,
    toggleTrackChangesForUser,
    trackChanges,
    trackChangesState,
    trackChangesVisible,
    updateEntries,
    user.id,
  ])

  const values = useMemo<ReviewPanelStateReactIde['values']>(
    () => ({
      collapsed,
      commentThreads,
      entries,
      entryHover,
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
      loading,
      openDocId,
      lineHeight,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
      layoutSuspended,
      unsavedComment,
    }),
    [
      collapsed,
      commentThreads,
      entries,
      entryHover,
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
      loading,
      openDocId,
      lineHeight,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
      layoutSuspended,
      unsavedComment,
    ]
  )

  const updaterFns = useMemo<ReviewPanelStateReactIde['updaterFns']>(
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
      setEntryHover,
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
      setEntryHover,
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
