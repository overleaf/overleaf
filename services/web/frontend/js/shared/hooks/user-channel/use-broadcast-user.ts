import { useEffect } from 'react'
import { useUserContext } from '@/shared/context/user-context'
import { useUserChannel } from './use-user-channel'

export const useBroadcastUser = () => {
  const user = useUserContext()
  const channel = useUserChannel()

  useEffect(() => {
    channel?.postMessage(user)
  }, [channel, user])
}
