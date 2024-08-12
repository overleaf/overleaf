import { UserId } from '../../../../../types/user'
import { createContext, FC, useContext, useEffect, useState } from 'react'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useUserContext } from '@/shared/context/user-context'

export type TrackChangesState = boolean | Record<UserId | '__guests__', boolean>

export const TrackChangesStateContext = createContext<
  TrackChangesState | undefined
>(undefined)

export const TrackChangesStateProvider: FC = ({ children }) => {
  const { socket } = useConnectionContext()
  const project = useProjectContext()
  const user = useUserContext()
  const { setWantTrackChanges } = useEditorManagerContext()

  // TODO: update project.trackChangesState instead?
  const [value, setValue] = useState<TrackChangesState>(
    project.trackChangesState ?? false
  )

  useSocketListener(socket, 'toggle-track-changes', setValue)

  useEffect(() => {
    setWantTrackChanges(
      value === true || (value !== false && value[user.id ?? '__guests__'])
    )
  }, [setWantTrackChanges, value, user.id])

  return (
    <TrackChangesStateContext.Provider value={value}>
      {children}
    </TrackChangesStateContext.Provider>
  )
}

export const useTrackChangesStateContext = () => {
  return useContext(TrackChangesStateContext)
}
