import * as React from 'react'
import useSafeDispatch from './use-safe-dispatch'
import { Nullable } from '../../../../types/utils'

type State = {
  status: 'idle' | 'pending' | 'resolved' | 'rejected'
  data: Nullable<unknown>
  error: Nullable<Record<string, unknown>>
}
type Action = Partial<State>

const defaultInitialState: State = { status: 'idle', data: null, error: null }

function useAsync(initialState?: Partial<State>) {
  const initialStateRef = React.useRef({
    ...defaultInitialState,
    ...initialState,
  })
  const [{ status, data, error }, setState] = React.useReducer(
    (state: State, action: Action) => ({ ...state, ...action }),
    initialStateRef.current
  )

  const safeSetState = useSafeDispatch(setState)

  const setData = React.useCallback(
    data => safeSetState({ data, status: 'resolved' }),
    [safeSetState]
  )

  const setError = React.useCallback(
    error => safeSetState({ error, status: 'rejected' }),
    [safeSetState]
  )

  const reset = React.useCallback(
    () => safeSetState(initialStateRef.current),
    [safeSetState]
  )

  const runAsync = React.useCallback(
    <T>(promise: Promise<T>) => {
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
