import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react'
import _ from 'lodash'
import { useIdeContext } from '../context/ide-context'

/**
 * Binds a property in an Angular scope making it accessible in a React
 * component. The interface is compatible with React.useState(), including
 * the option of passing a function to the setter.
 */
export default function useScopeValue<T = any>(
  path: string, // dot '.' path of a property in the Angular scope
  deep = false
): [T, Dispatch<SetStateAction<T>>] {
  const { $scope } = useIdeContext()

  const [value, setValue] = useState<T>(() => _.get($scope, path))

  useEffect(() => {
    return $scope.$watch(
      path,
      newValue => {
        setValue(() => {
          // NOTE: this is deliberately wrapped in a function,
          // to avoid calling setValue directly with a value that's a function
          return deep ? _.cloneDeep(newValue) : newValue
        })
      },
      deep
    )
  }, [path, $scope, deep])

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
