import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'
import { useIdeContext } from '../ide-context'

/**
 * Binds a property in an Angular scope making it accessible in a React
 * component. The interface is compatible with React.useState(), including
 * the option of passing a function to the setter.
 *
 * @param {string} path - dot '.' path of a property in the Angular scope.
 * @param {boolean} deep
 * @returns {[any, function]} - Binded value and setter function tuple.
 */
export default function useScopeValue(path, deep = false) {
  const { $scope } = useIdeContext({
    $scope: PropTypes.object.isRequired,
  })

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
