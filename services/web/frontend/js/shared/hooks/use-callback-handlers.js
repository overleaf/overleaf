import { useCallback, useState } from 'react'

export default function useCallbackHandlers() {
  const [handlers, setHandlers] = useState(new Set())

  const addHandler = useCallback(
    handler => {
      setHandlers(prev => new Set(prev.add(handler)))
    },
    [setHandlers]
  )

  const deleteHandler = useCallback(
    handler => {
      setHandlers(prev => {
        prev.delete(handler)
        return new Set(prev)
      })
    },
    [setHandlers]
  )

  const callHandlers = useCallback(
    (...args) => {
      for (const handler of handlers) {
        handler(...args)
      }
    },
    [handlers]
  )

  return { addHandler, deleteHandler, callHandlers }
}
