import 'abort-controller/polyfill'
import { useEffect, useState } from 'react'

export default function useAbortController() {
  const [controller] = useState(() => new AbortController())

  useEffect(() => {
    return () => {
      controller.abort()
    }
  }, [controller])

  return controller
}
