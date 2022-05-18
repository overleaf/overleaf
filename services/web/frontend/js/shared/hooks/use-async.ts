import * as React from 'react'
import useSafeDispatch from './use-safe-dispatch'
import { Nullable } from '../../../../types/utils'

type State<T> = {
  status: 'idle' | 'pending' | 'resolved' | 'rejected'
  data: Nullable<T>
  error: Nullable<Error>
}
type Action<T> = Partial<State<T>>

const defaultInitialState: State<null> = {
  status: 'idle',
  data: null,
  error: null,
}

function useAsync<T = any>(initialState?: Partial<State<T>>) {
  const initialStateRef = React.useRef({
    ...defaultInitialState,
    ...initialState,
  })
  const [{ status, data, error }, setState] = React.useReducer(
    (state: State<T>, action: Action<T>) => ({ ...state, ...action }),
    initialStateRef.current
  )

  const safeSetState = useSafeDispatch(setState)

  const setData = React.useCallback(
    (data: Nullable<T>) => safeSetState({ data, status: 'resolved' }),
    [safeSetState]
  )

  const setError = React.useCallback(
    (error: Nullable<Error>) => safeSetState({ error, status: 'rejected' }),
    [safeSetState]
  )

  const reset = React.useCallback(
    () => safeSetState(initialStateRef.current),
    [safeSetState]
  )

  const runAsync = React.useCallback(
    (promise: Promise<T>) => {
      safeSetState({ status: 'pending' })

      return promise.then(
        data => {
          setData(data)
          return data
        },
        error => {
          setError(error)
          return Promise.reject(error)
        }
      )
    },
    [safeSetState, setData, setError]
  )

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
  }
}

export default useAsync
export type UseAsyncReturnType = ReturnType<typeof useAsync>
