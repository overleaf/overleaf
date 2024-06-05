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
 *
 * The generic type is not an actual guarantee because the value for a path is
 * returned as undefined when there is nothing in the scope store for that path.
 */
export default function useScopeValue<T = any>(
  path: string // dot '.' path of a property in the Angular scope
): [T, Dispatch<SetStateAction<T>>] {
  const { scopeStore } = useIdeContext()

  const [value, setValue] = useState<T>(() => scopeStore.get(path))

  useEffect(() => {
    return scopeStore.watch<T>(path, (newValue: T) => {
      // NOTE: this is deliberately wrapped in a function,
      // to avoid calling setValue directly with a value that's a function
      setValue(() => newValue)
    })
  }, [path, scopeStore])

  const scopeSetter = useCallback(
    (newValue: SetStateAction<T>) => {
      setValue(val => {
        const actualNewValue = _.isFunction(newValue) ? newValue(val) : newValue
        scopeStore.set(path, actualNewValue)
        return actualNewValue
      })
    },
    [path, scopeStore]
  )

  return [value, scopeSetter]
}
