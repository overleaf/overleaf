import { type Dispatch, type SetStateAction, useState } from 'react'
import { useUnstableStoreSync } from '@/shared/hooks/use-unstable-store-sync'

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
  useUnstableStoreSync(path, value)

  return [value, setValue]
}
