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
const initializer = (initialState: State) => ({ ...initialState })

function useAsync(initialState?: Partial<State>) {
  const [{ status, data, error }, setState] = React.useReducer(
    (state: State, action: Action) => ({ ...state, ...action }),
    { ...defaultInitialState, ...initialState },
    initializer
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

  const runAsync = React.useCallback(
    (promise: Promise<Record<string, unknown>>) => {
      safeSetState({ status: 'pending' })

      return promise.then(setData, setError)
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
  }
}

export default useAsync
export type UseAsyncReturnType = ReturnType<typeof useAsync>
