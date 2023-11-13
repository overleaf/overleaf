import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import useEventListener from '@/shared/hooks/use-event-listener'
import useDomEventListener from '@/shared/hooks/use-dom-event-listener'

export function useRegisterUserActivity() {
  const { registerUserActivity } = useConnectionContext()

  useEventListener('cursor:editor:update', registerUserActivity)
  useDomEventListener(document.body, 'click', registerUserActivity)
}
