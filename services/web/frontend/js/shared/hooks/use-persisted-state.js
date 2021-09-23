import { useState, useCallback } from 'react'
import localStorage from '../../infrastructure/local-storage'

function usePersistedState(key, defaultValue) {
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

  return [value, updateFunction]
}

export default usePersistedState
