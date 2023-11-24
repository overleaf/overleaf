import {
  useState,
  useCallback,
  useEffect,
  SetStateAction,
  Dispatch,
} from 'react'
import _ from 'lodash'
import localStorage from '../../infrastructure/local-storage'
import { debugConsole } from '@/utils/debugging'

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch (e) {
    debugConsole.error('double stringify exception', e)
    return null
  }
}

const safeParse = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (e) {
    debugConsole.error('double parse exception', e)
    return null
  }
}

function usePersistedState<T = any>(
  key: string,
  defaultValue?: T,
  listen = false,
  // The option below is for backward compatibility with Angular
  // which sometimes stringifies the values twice
  doubleStringifyAndParse = false
): [T, Dispatch<SetStateAction<T>>] {
  const getItem = useCallback(
    (key: string) => {
      const item = localStorage.getItem(key)
      return doubleStringifyAndParse ? safeParse(item) : item
    },
    [doubleStringifyAndParse]
  )
  const setItem = useCallback(
    (key: string, value: unknown) => {
      const val = doubleStringifyAndParse ? safeStringify(value) : value
      localStorage.setItem(key, val)
    },
    [doubleStringifyAndParse]
  )

  const [value, setValue] = useState<T>(() => {
    return getItem(key) ?? defaultValue
  })

  const updateFunction = useCallback(
    (newValue: SetStateAction<T>) => {
      setValue(value => {
        const actualNewValue = _.isFunction(newValue)
          ? newValue(value)
          : newValue

        if (actualNewValue === defaultValue) {
          localStorage.removeItem(key)
        } else {
          setItem(key, actualNewValue)
        }

        return actualNewValue
      })
    },
    [key, defaultValue, setItem]
  )

  useEffect(() => {
    if (listen) {
      const listener = (event: StorageEvent) => {
        if (event.key === key) {
          // note: this value is read via getItem rather than from event.newValue
          // because getItem handles deserializing the JSON that's stored in localStorage.
          setValue(getItem(key) ?? defaultValue)
        }
      }

      window.addEventListener('storage', listener)

      return () => {
        window.removeEventListener('storage', listener)
      }
    }
  }, [defaultValue, key, listen, getItem])

  return [value, updateFunction]
}

export default usePersistedState
