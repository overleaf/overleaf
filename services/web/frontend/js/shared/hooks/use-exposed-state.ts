import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { useIdeContext } from '../context/ide-context'

/**
 * Creates a state variable that is exposed via window.overleaf.unstable.store,
 * which is used by Writefull (and only Writefull). Once Writefull is integrated
 * into our codebase, it should be able to hook directly into our React
 * contexts and we would then be able to remove this hook, replacing it with
 * useState.
 */
export default function useExposedState<T = any>(
  initialState: T | (() => T),
  path: string
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialState)

  const { unstableStore } = useIdeContext()

  // Update the unstable store whenever the value changes
  useEffect(() => {
    unstableStore.set(path, value)
  }, [unstableStore, path, value])

  return [value, setValue]
}
