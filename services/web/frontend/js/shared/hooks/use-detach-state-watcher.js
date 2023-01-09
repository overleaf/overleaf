import { useEffect } from 'react'
import useDetachState from './use-detach-state'

function useDetachStateWatcher(key, stateValue, senderRole, targetRole) {
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
