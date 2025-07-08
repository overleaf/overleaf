import { useIdeContext } from '@/shared/context/ide-context'
import { useEffect } from 'react'

export function useUnstableStoreSync<T = any>(path: string, value: T) {
  const { unstableStore } = useIdeContext()

  // Update the unstable store whenever the value changes
  useEffect(() => {
    unstableStore.set(path, value)
  }, [unstableStore, path, value])
}
