import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from 'react'
import { useIdeContext } from '../context/ide-context'
import _ from 'lodash'

/**
 * Similar to `useScopeValue`, but instead of creating a two-way binding, only
 * changes in react-> angular direction are propagated, with `value` remaining
 * local and independent of its value in the Angular scope.
 *
 * The interface is compatible with React.useState(), including
 * the option of passing a function to the setter.
 */
export default function useScopeValueSetterOnly<T = any>(
  path: string, // dot '.' path of a property in the Angular scope.
  defaultValue?: T
): [T, Dispatch<SetStateAction<T>>] {
  const { $scope } = useIdeContext()

  const [value, setValue] = useState<T>(defaultValue)

  const scopeSetter = useCallback(
    (newValue: SetStateAction<T>) => {
      setValue(val => {
        const actualNewValue = _.isFunction(newValue) ? newValue(val) : newValue
        $scope.$applyAsync(() => _.set($scope, path, actualNewValue))
        return actualNewValue
      })
    },
    [path, $scope]
  )

  return [value, scopeSetter]
}
