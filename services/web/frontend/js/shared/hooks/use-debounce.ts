import { useEffect, useState } from 'react'

/**
 * @template T
 * @param {T} value
 * @param {number} delay
 * @returns {T}
 */
export default function useDebounce<T>(value: T, delay = 0) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
