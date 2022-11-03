import { DependencyList, useMemo, useRef } from 'react'
import { isEqual } from 'lodash'

function useDeepCompare(dependencies: DependencyList) {
  const ref = useRef<DependencyList>([])
  if (!isEqual(ref.current, dependencies)) {
    ref.current = dependencies
  }
  return ref.current
}

export default function useDeepCompareMemo<T>(
  factory: () => T,
  dependencies: DependencyList
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, useDeepCompare(dependencies))
}
