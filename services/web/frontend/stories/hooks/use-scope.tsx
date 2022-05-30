import { merge } from 'lodash'
import { useLayoutEffect, useRef } from 'react'

/**
 * Merge properties with the scope object, for use in Storybook stories
 */
export const useScope = (scope: Record<string, unknown>) => {
  const scopeRef = useRef<typeof scope | null>(null)
  if (scopeRef.current === null) {
    scopeRef.current = scope
  }

  useLayoutEffect(() => {
    merge(window._ide.$scope, scopeRef.current)
  }, [])
}
