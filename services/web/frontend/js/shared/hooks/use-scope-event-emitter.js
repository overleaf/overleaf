import { useCallback } from 'react'
import { useIdeContext } from '../context/ide-context'

/**
 * @param {string} eventName
 * @param {boolean} [broadcast]
 * @returns function
 */
export default function useScopeEventEmitter(eventName, broadcast = true) {
  const { $scope } = useIdeContext()

  return useCallback(
    detail => {
      if (broadcast) {
        $scope.$broadcast(eventName, detail)
      } else {
        $scope.$emit(eventName, detail)
      }
    },
    [$scope, eventName, broadcast]
  )
}
