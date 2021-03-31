import { useCallback, useEffect, useState } from 'react'
import _ from 'lodash'

/**
 * Binds a property in an Angular scope making it accessible in a React
 * component. The interface is compatible with React.useState(), including
 * the option of passing a function to the setter.
 *
 * @param {string} path - dot '.' path of a property in `sourceScope`.
 * @param {object} $scope - Angular $scope containing the value to bind.
 * @param {boolean} deep
 * @returns {[any, function]} - Binded value and setter function tuple.
 */
export default function useScopeValue(path, $scope, deep = false) {
  const [value, setValue] = useState(() => _.get($scope, path))

  useEffect(() => {
    return $scope.$watch(
      path,
      newValue => {
        setValue(deep ? _.cloneDeep(newValue) : newValue)
      },
      deep
    )
  }, [path, $scope, deep])

  const scopeSetter = useCallback(
    newValue => {
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
