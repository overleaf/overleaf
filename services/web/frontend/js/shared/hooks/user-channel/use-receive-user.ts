import { useEffect } from 'react'
import { useUserChannel } from './use-user-channel'

export const useReceiveUser = (
  handleData: (data: Record<string, any>) => void
) => {
  const channel = useUserChannel()

  useEffect(() => {
    const abortController = new AbortController()
    channel?.addEventListener('message', ({ data }) => handleData(data), {
      signal: abortController.signal,
    })
    return () => abortController.abort()
  }, [channel, handleData])
}
