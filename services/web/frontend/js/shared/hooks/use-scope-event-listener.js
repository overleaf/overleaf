import { useEffect } from 'react'
import { useIdeContext } from '../context/ide-context'

/**
 * @param {string} eventName
 * @param {function} [listener]
 */
export default function useScopeEventListener(eventName, listener) {
  const { $scope } = useIdeContext()

  useEffect(() => {
    return $scope.$on(eventName, listener)
  }, [$scope, eventName, listener])
}
