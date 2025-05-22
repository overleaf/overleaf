import { UserId } from '../../../../../types/user'
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useUserContext } from '@/shared/context/user-context'
import { postJSON } from '@/infrastructure/fetch-json'
import useEventListener from '@/shared/hooks/use-event-listener'
import { ProjectContextValue } from '@/shared/context/types/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

export type TrackChangesState = {
  onForEveryone: boolean
  onForMembers: Record<UserId, boolean | undefined>
}

export const TrackChangesStateContext = createContext<
  TrackChangesState | undefined
>(undefined)

type SaveTrackChangesRequestBody = {
  on?: boolean
  on_for?: Record<UserId, boolean | undefined>
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
  const project = useProjectContext()
  const user = useUserContext()
  const { setWantTrackChanges } = useEditorManagerContext()

  // TODO: update project.trackChangesState instead?
  const [trackChangesValue, setTrackChangesValue] = useState<
    ProjectContextValue['trackChangesState']
  >(project.trackChangesState ?? false)

  useSocketListener(socket, 'toggle-track-changes', setTrackChangesValue)

  useEffect(() => {
    setWantTrackChanges(
      trackChangesValue === true ||
        (trackChangesValue !== false && !!user.id && trackChangesValue[user.id])
    )
  }, [setWantTrackChanges, trackChangesValue, user.id])

  const trackChangesIsObject =
    trackChangesValue !== true && trackChangesValue !== false
  const onForEveryone = trackChangesValue === true

  const onForMembers = useMemo(() => {
    const onForMembers: Record<UserId, boolean | undefined> = {}
    if (trackChangesIsObject) {
      for (const key of Object.keys(trackChangesValue)) {
        // TODO: Remove this check when we have converted
        // all projects to the current format.
        if (key !== '__guests__') {
          onForMembers[key as UserId] = trackChangesValue[key as UserId]
        }
      }
    }
    return onForMembers
  }, [trackChangesIsObject, trackChangesValue])

  const saveTrackChanges = useCallback(
    async (trackChangesBody: SaveTrackChangesRequestBody) => {
      postJSON(`/project/${project._id}/track_changes`, {
        body: trackChangesBody,
      })
    },
    [project._id]
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
      if (
        user.id &&
        project.features.trackChanges &&
        permissions.write &&
        !onForEveryone
      ) {
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
      onForEveryone,
      permissions.write,
      project.features.trackChanges,
      user.id,
    ])
  )

  const value = useMemo(
    () => ({ onForEveryone, onForMembers }),
    [onForEveryone, onForMembers]
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
