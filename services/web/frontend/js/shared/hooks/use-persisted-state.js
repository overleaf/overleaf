import { useState, useCallback, useEffect } from 'react'
import localStorage from '../../infrastructure/local-storage'

/**
 * @param {string} key
 * @param {any} [defaultValue]
 * @param {boolean} [listen]
 *
 * @returns {[any, function]}
 */
function usePersistedState(key, defaultValue, listen = false) {
  const [value, setValue] = useState(() => {
    return localStorage.getItem(key) ?? defaultValue
  })

  const updateFunction = useCallback(
    newValue => {
      setValue(value => {
        const actualNewValue =
          typeof newValue === 'function' ? newValue(value) : newValue

        if (actualNewValue === defaultValue) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, actualNewValue)
        }

        return actualNewValue
      })
    },
    [key, defaultValue]
  )

  useEffect(() => {
    if (listen) {
      const listener = event => {
        if (event.key === key) {
          // note: this value is read via getItem rather than from event.newValue
          // because getItem handles deserializing the JSON that's stored in localStorage.
          setValue(localStorage.getItem(key))
        }
      }

      window.addEventListener('storage', listener)

      return () => {
        window.removeEventListener('storage', listener)
      }
    }
  }, [key, listen])

  return [value, updateFunction]
}

export default usePersistedState
