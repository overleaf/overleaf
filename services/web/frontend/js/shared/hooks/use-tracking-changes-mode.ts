import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useTrackChangesStateContext } from '@/features/review-panel/context/track-changes-state-context'
import { useUserContext } from '../context/user-context'

type Mode = 'view' | 'review' | 'edit'

export const useTrackingChangesMode = (): Mode => {
  const trackChanges = useTrackChangesStateContext()
  const user = useUserContext()
  const { permissionsLevel } = useIdeReactContext()

  if (permissionsLevel === 'readOnly') {
    return 'view'
  } else if (permissionsLevel === 'review') {
    return 'review'
  }

  const trackChangesForCurrentUser =
    trackChanges?.onForEveryone ||
    (user?.id && trackChanges?.onForMembers[user.id]) ||
    (!user?.id && trackChanges?.onForGuests)

  if (trackChangesForCurrentUser) {
    return 'review'
  } else {
    return 'edit'
  }
}
