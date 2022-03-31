import { useCallback, useRef } from 'react'

export default function useCallbackHandlers() {
  const handlersRef = useRef(new Set())

  const addHandler = useCallback(handler => {
    handlersRef.current.add(handler)
  }, [])

  const deleteHandler = useCallback(handler => {
    handlersRef.current.delete(handler)
  }, [])

  const callHandlers = useCallback((...args) => {
    for (const handler of handlersRef.current) {
      handler(...args)
    }
  }, [])

  return { addHandler, deleteHandler, callHandlers }
}
