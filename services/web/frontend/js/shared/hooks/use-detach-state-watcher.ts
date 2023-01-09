import { useEffect } from 'react'
import useDetachState, {
  DetachRole,
  DetachTargetRole,
} from './use-detach-state'

type UseDetachParams = Parameters<typeof useDetachState>

function useDetachStateWatcher<
  S extends DetachRole,
  T extends DetachTargetRole<S>
>(
  key: UseDetachParams[0],
  stateValue: UseDetachParams[1],
  senderRole: S,
  targetRole: T
) {
  const [value, setValue] = useDetachState(
    key,
    stateValue,
    senderRole,
    targetRole
  )

  useEffect(() => {
    setValue(stateValue)
  }, [setValue, stateValue])

  return [value, setValue]
}

export default useDetachStateWatcher
