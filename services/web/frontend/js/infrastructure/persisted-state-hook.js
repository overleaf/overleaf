import { useState, useCallback } from 'react'
import localStorage from './local-storage'

function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    const keyExists = localStorage.getItem(key) != null
    return keyExists ? localStorage.getItem(key) : defaultValue
  })

  const updateFunction = useCallback(
    newValue => {
      if (newValue === defaultValue) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, newValue)
      }
      setValue(newValue)
    },
    [key, defaultValue]
  )

  return [value, updateFunction]
}

export default usePersistedState
