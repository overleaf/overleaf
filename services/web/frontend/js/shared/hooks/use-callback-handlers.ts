import { useCallback, useRef } from 'react'

export default function useCallbackHandlers() {
  const handlersRef = useRef(new Set<(...arg: unknown[]) => void>())

  const addHandler = useCallback((handler: (...args: unknown[]) => void) => {
    handlersRef.current.add(handler)
  }, [])

  const deleteHandler = useCallback((handler: (...args: unknown[]) => void) => {
    handlersRef.current.delete(handler)
  }, [])

  const callHandlers = useCallback((...args: unknown[]) => {
    for (const handler of handlersRef.current) {
      handler(...args)
    }
  }, [])

  return { addHandler, deleteHandler, callHandlers }
}
