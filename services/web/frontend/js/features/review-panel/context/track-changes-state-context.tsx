import { UserId } from '../../../../../types/user'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { useUserContext } from '@/shared/context/user-context'
import { postJSON } from '@/infrastructure/fetch-json'
import useEventListener from '@/shared/hooks/use-event-listener'
import {
  ProjectMetadata,
  TrackChangesStateData,
} from '@/shared/context/types/project-metadata'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

export type TrackChangesState = {
  onForGuests: boolean
  onForMembers: Record<UserId, boolean | undefined>
}

export const TrackChangesStateContext = createContext<
  TrackChangesState | undefined
>(undefined)

type SaveTrackChangesRequestBody = {
  on_for?: Record<UserId, boolean | undefined>
  on_for_guests?: boolean
}

type TrackChangesStateActions = {
  saveTrackChanges: (trackChangesBody: SaveTrackChangesRequestBody) => void
  saveTrackChangesForCurrentUser: (trackChanges: boolean) => void
}

const TrackChangesStateActionsContext = createContext<
  TrackChangesStateActions | undefined
>(undefined)

export const TrackChangesStateProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const permissions = usePermissionsContext()
  const { socket } = useConnectionContext()
  const { projectId, project, updateProject, features } = useProjectContext()
  const user = useUserContext()
  const { setWantTrackChanges } = useEditorPropertiesContext()

  const trackChangesValue = useMemo<TrackChangesStateData>(() => {
    if (typeof project?.trackChangesState === 'object') {
      return project.trackChangesState
    } else {
      return {}
    }
  }, [project?.trackChangesState])

  useSocketListener(
    socket,
    'toggle-track-changes',
    useCallback(
      (newValue: ProjectMetadata['trackChangesState']) => {
        updateProject({ trackChangesState: newValue })
      },
      [updateProject]
    )
  )

  useEffect(() => {
    setWantTrackChanges(Boolean(trackChangesValue[user.id ?? '__guests__']))
  }, [setWantTrackChanges, trackChangesValue, user.id])
  const onForGuests = trackChangesValue.__guests__ === true

  const onForMembers = useMemo(() => {
    const onForMembers: Record<UserId, boolean | undefined> = {}
    for (const key of Object.keys(trackChangesValue)) {
      if (key !== '__guests__') {
        onForMembers[key as UserId] = trackChangesValue[key as UserId]
      }
    }
    return onForMembers
  }, [trackChangesValue])

  const saveTrackChanges = useCallback(
    async (trackChangesBody: SaveTrackChangesRequestBody) => {
      postJSON(`/project/${projectId}/track_changes`, {
        body: trackChangesBody,
      })
    },
    [projectId]
  )

  const saveTrackChangesForCurrentUser = useCallback(
    async (trackChanges: boolean) => {
      if (user.id) {
        saveTrackChanges({
          on_for: {
            ...onForMembers,
            [user.id]: trackChanges,
          },
        })
      }
    },
    [onForMembers, user.id, saveTrackChanges]
  )

  const actions = useMemo(
    () => ({
      saveTrackChanges,
      saveTrackChangesForCurrentUser,
    }),
    [saveTrackChanges, saveTrackChangesForCurrentUser]
  )

  useEventListener(
    'toggle-track-changes',
    useCallback(() => {
      if (user.id && features.trackChanges && permissions.write) {
        const value = onForMembers[user.id]
        actions.saveTrackChanges({
          on_for: {
            ...onForMembers,
            [user.id]: !value,
          },
        })
      }
    }, [
      actions,
      onForMembers,
      permissions.write,
      features.trackChanges,
      user.id,
    ])
  )

  const value = useMemo(
    () => ({ onForGuests, onForMembers }),
    [onForGuests, onForMembers]
  )

  return (
    <TrackChangesStateActionsContext.Provider value={actions}>
      <TrackChangesStateContext.Provider value={value}>
        {children}
      </TrackChangesStateContext.Provider>
    </TrackChangesStateActionsContext.Provider>
  )
}

export const useTrackChangesStateContext = () => {
  return useContext(TrackChangesStateContext)
}

export const useTrackChangesStateActionsContext = () => {
  const context = useContext(TrackChangesStateActionsContext)
  if (!context) {
    throw new Error(
      'useTrackChangesStateActionsContext is only available inside TrackChangesStateProvider'
    )
  }
  return context
}
