import * as React from 'react'
import useSafeDispatch from './use-safe-dispatch'
import { Nullable } from '../../../../types/utils'
import { FetchError } from '../../infrastructure/fetch-json'

type State<T, E> = {
  status: 'idle' | 'pending' | 'resolved' | 'rejected'
  data: Nullable<T>
  error: Nullable<E>
}
type Action<T, E> = Partial<State<T, E>>
type AsyncRunner<T> = (signal: AbortSignal) => Promise<T>

const defaultInitialState: State<null, null> = {
  status: 'idle',
  data: null,
  error: null,
}

const abortError = new Error('Aborted by the caller')
abortError.name = 'AbortError'

function useAsync<T = any, E extends Error | FetchError = Error>(
  initialState?: Partial<State<T, E>>
) {
  const initialStateRef = React.useRef({
    ...defaultInitialState,
    ...initialState,
  })

  // Use a Set to track all active AbortController instances
  const abortControllerSetRef = React.useRef<Set<AbortController>>(new Set())

  const [{ status, data, error }, setState] = React.useReducer(
    (state: State<T, E>, action: Action<T, E>) => ({ ...state, ...action }),
    initialStateRef.current
  )

  const safeSetState = useSafeDispatch(setState)

  const setData = React.useCallback(
    (data: Nullable<T>) => safeSetState({ data, status: 'resolved' }),
    [safeSetState]
  )

  const setError = React.useCallback(
    (error: Nullable<E>) => safeSetState({ error, status: 'rejected' }),
    [safeSetState]
  )

  const reset = React.useCallback(
    () => safeSetState(initialStateRef.current),
    [safeSetState]
  )

  const cancelAll = React.useCallback(() => {
    // Abort all controllers in the set and clear it
    abortControllerSetRef.current.forEach(controller => controller.abort())
    abortControllerSetRef.current.clear()
  }, [])

  const runAsync = React.useCallback(
    (asyncRunner: AsyncRunner<T>) => {
      safeSetState({ status: 'pending' })

      const controller = new AbortController()
      abortControllerSetRef.current.add(controller)

      // The original promise is now created using the provided factory function,
      // which receives the signal for cancellation.
      const promise = asyncRunner(controller.signal)

      const abortPromise = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(abortError)
        })
      })

      return Promise.race([promise, abortPromise])
        .then(
          data => {
            setData(data)
            return data
          },
          error => {
            if (error !== abortError) {
              setError(error)
            }
            return Promise.reject(error)
          }
        )
        .finally(() => {
          // Remove the controller from the set, whether it succeeded or failed
          abortControllerSetRef.current.delete(controller)
        })
    },
    [safeSetState, setData, setError]
  )

  // Abort all requests when the component unmounts to prevent memory leaks
  React.useEffect(() => {
    return () => {
      cancelAll()
    }
  }, [cancelAll])

  return {
    isIdle: status === 'idle',
    isLoading: status === 'pending',
    isError: status === 'rejected',
    isSuccess: status === 'resolved',
    setData,
    setError,
    error,
    status,
    data,
    runAsync,
    reset,
    cancelAll,
  }
}

export default useAsync
export { useAsync, abortError }
