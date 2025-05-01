import { useEffect, useRef } from 'react'

export const useUserChannel = (): BroadcastChannel | null => {
  const channelRef = useRef<BroadcastChannel | null>(null)

  if (channelRef.current === null && 'BroadcastChannel' in window) {
    channelRef.current = new BroadcastChannel('user')
  }

  useEffect(() => {
    return () => channelRef.current?.close?.()
  }, [])

  return channelRef.current
}
