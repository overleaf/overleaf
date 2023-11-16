import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import { dispatchReviewPanelLayout as handleLayoutChange } from '@/features/source-editor/extensions/changes/change-manager'
import { useProjectContext } from '@/shared/context/project-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useUserContext } from '@/shared/context/user-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugConsole } from '@/utils/debugging'
import { postJSON } from '@/infrastructure/fetch-json'
import { ReviewPanelStateReactIde } from '../types/review-panel-state'
import ColorManager from '@/ide/colors/ColorManager'
import * as ReviewPanel from '../types/review-panel-state'
import {
  SubView,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { UserId } from '../../../../../../../types/user'
import { PublicAccessLevel } from '../../../../../../../types/public-access-level'
import { DeepReadonly } from '../../../../../../../types/utils'

function formatUser(user: any): any {
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

function useReviewPanelState(): ReviewPanelStateReactIde {
  const { reviewPanelOpen, setReviewPanelOpen } = useLayoutContext()
  const { projectId } = useIdeReactContext()
  const project = useProjectContext()
  const user = useUserContext()
  const { socket } = useConnectionContext()
  const {
    features: { trackChangesVisible, trackChanges },
  } = project

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

  const [wantTrackChanges, setWantTrackChanges] = useScopeValue<
    ReviewPanel.Value<'wantTrackChanges'>
  >('editor.wantTrackChanges')
  const [openDocId] =
    useScopeValue<ReviewPanel.Value<'openDocId'>>('editor.open_doc_id')
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
      requestAnimationFrame(() => {
        if (trackChanges) {
          applyTrackChangesStateToClient(project.trackChangesState)
        } else {
          applyTrackChangesStateToClient(false)
        }
        setGuestFeatureBasedOnProjectAccessLevel(project.publicAccessLevel)
      })
      projectJoinedEffectExecuted.current = true
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

  const [entryHover, setEntryHover] = useState(false)
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [navHeight, setNavHeight] = useState(0)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [layoutSuspended, setLayoutSuspended] = useState(false)

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

    const handleEditorEvents = (e: Event) => {
      const event = e as CustomEvent
      const { type } = event.detail

      switch (type) {
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
    toggleTrackChangesForUser,
    trackChanges,
    trackChangesState,
    trackChangesVisible,
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
    ]
  )

  return { values, updaterFns }
}

export default useReviewPanelState
