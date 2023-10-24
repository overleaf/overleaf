import { useEffect } from 'react'
import { useIdeContext } from '../context/ide-context'

export default function useScopeEventListener(
  eventName: string,
  listener: (...args: unknown[]) => void
) {
  const { $scope } = useIdeContext()

  useEffect(() => {
    return $scope.$on(eventName, listener)
  }, [$scope, eventName, listener])
}
