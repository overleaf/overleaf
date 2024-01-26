import { useCallback, useRef } from 'react'

export default function useCallbackHandlers() {
  const handlersRef = useRef(new Set<(...arg: any[]) => void>())

  const addHandler = useCallback((handler: (...args: any[]) => void) => {
    handlersRef.current.add(handler)
  }, [])

  const deleteHandler = useCallback((handler: (...args: any[]) => void) => {
    handlersRef.current.delete(handler)
  }, [])

  const callHandlers = useCallback((...args: any[]) => {
    for (const handler of handlersRef.current) {
      handler(...args)
    }
  }, [])

  return { addHandler, deleteHandler, callHandlers }
}
