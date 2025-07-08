import {
  useState,
  useCallback,
  useEffect,
  SetStateAction,
  Dispatch,
} from 'react'
import _ from 'lodash'
import localStorage from '../../infrastructure/local-storage'

type UsePersistedStateOptions<Value, PersistedValue> = {
  listen?: boolean
  converter?: {
    toPersisted: (value: Value) => PersistedValue
    fromPersisted: (persisted: PersistedValue) => Value
  }
}

function usePersistedState<Value, PersistedValue = Value>(
  key: string,
  defaultValue?: Value,
  options?: UsePersistedStateOptions<Value, PersistedValue>
): [Value, Dispatch<SetStateAction<Value>>] {
  // Store the default value and options on first render so that they're stable
  // and use them on subsequent renders. This is important for, for example, a
  // non-primitive default value that should not change on every render.
  const [allOptions] = useState<{
    defaultValue?: Value
    options?: UsePersistedStateOptions<Value, PersistedValue>
  }>(() => ({ defaultValue, options }))
  const listen = allOptions.options?.listen || false
  const { toPersisted, fromPersisted } = allOptions.options?.converter || {}
  const storedDefaultValue = allOptions.defaultValue

  const getItem = useCallback(
    (key: string) => {
      const item = localStorage.getItem(key)
      return fromPersisted ? fromPersisted(item) : item
    },
    [fromPersisted]
  )
  const setItem = useCallback(
    (key: string, value: Value) => {
      // Nested ternary is convenient for type inference
      const val = toPersisted ? toPersisted(value) : value
      localStorage.setItem(key, val)
    },
    [toPersisted]
  )

  const [value, setValue] = useState<Value>(() => {
    return getItem(key) ?? storedDefaultValue
  })

  const updateFunction = useCallback(
    (newValue: SetStateAction<Value>) => {
      setValue(value => {
        const actualNewValue = _.isFunction(newValue)
          ? newValue(value)
          : newValue

        if (actualNewValue === storedDefaultValue) {
          localStorage.removeItem(key)
        } else {
          setItem(key, actualNewValue)
        }

        return actualNewValue
      })
    },
    [key, storedDefaultValue, setItem]
  )

  useEffect(() => {
    if (listen) {
      const listener = (event: StorageEvent) => {
        if (event.key === key) {
          // note: this value is read via getItem rather than from event.newValue
          // because getItem handles deserializing the JSON that's stored in localStorage.
          setValue(getItem(key) ?? storedDefaultValue)
        }
      }

      window.addEventListener('storage', listener)

      return () => {
        window.removeEventListener('storage', listener)
      }
    }
  }, [storedDefaultValue, key, listen, getItem])

  return [value, updateFunction]
}

export default usePersistedState
