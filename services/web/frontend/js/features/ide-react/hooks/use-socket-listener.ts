import { useEffect } from 'react'
import { Socket } from '@/features/ide-react/connection/types/socket'

type SocketOnParams = Parameters<Socket['on']>

export default function useSocketListener(
  socket: Socket,
  event: SocketOnParams[0],
  listener: SocketOnParams[1]
) {
  useEffect(() => {
    socket.on(event, listener)

    return () => {
      socket.removeListener(event, listener)
    }
  }, [event, listener, socket])
}
