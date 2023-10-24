import { useCallback } from 'react'
import { useIdeContext } from '../context/ide-context'

export default function useScopeEventEmitter(
  eventName: string,
  broadcast = true
) {
  const { $scope } = useIdeContext()

  return useCallback(
    (...detail: unknown[]) => {
      if (broadcast) {
        $scope.$broadcast(eventName, ...detail)
      } else {
        $scope.$emit(eventName, ...detail)
      }
    },
    [$scope, eventName, broadcast]
  )
}
