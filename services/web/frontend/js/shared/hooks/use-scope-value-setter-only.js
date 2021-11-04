import PropTypes from 'prop-types'
import { useCallback, useState } from 'react'
import { useIdeContext } from '../context/ide-context'
import _ from 'lodash'

/**
 * Similar to `useScopeValue`, but instead of creating a two-way binding, only
 * changes in react-> angular direction are propagated, with `value` remaining
 * local and independent of its value in the Angular scope.
 *
 * The interface is compatible with React.useState(), including
 * the option of passing a function to the setter.
 *
 * @param {string} path - dot '.' path of a property in the Angular scope.
 * @param {any} [defaultValue]
 * @returns {[any, function]} - value and setter function tuple.
 */
export default function useScopeValueSetterOnly(path, defaultValue) {
  const { $scope } = useIdeContext({
    $scope: PropTypes.object.isRequired,
  })

  const [value, setValue] = useState(defaultValue)

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
