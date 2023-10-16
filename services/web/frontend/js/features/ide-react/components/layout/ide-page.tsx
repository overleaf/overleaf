import LayoutWithPlaceholders from '@/features/ide-react/components/layout/layout-with-placeholders'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import useEventListener from '@/shared/hooks/use-event-listener'
import { useCallback, useEffect } from 'react'

// This is filled with placeholder content while the real content is migrated
// away from Angular
export default function IdePage() {
  const { registerUserActivity } = useConnectionContext()

  // Inform the connection manager when the user is active
  const listener = useCallback(
    () => registerUserActivity(),
    [registerUserActivity]
  )

  useEventListener('cursor:editor:update', listener)

  useEffect(() => {
    document.body.addEventListener('click', listener)
    return () => document.body.removeEventListener('click', listener)
  }, [listener])

  return (
    <>
      {/* TODO: Alerts and left menu will go here */}
      <LayoutWithPlaceholders shouldPersistLayout />
    </>
  )
}
