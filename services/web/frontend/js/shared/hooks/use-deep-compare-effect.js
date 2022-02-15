import { useEffect, useRef } from 'react'
import _ from 'lodash'

export default function useDeepCompareEffect(callback, dependencies) {
  const ref = useRef()
  return useEffect(() => {
    if (_.isEqual(dependencies, ref.current)) {
      return
    }
    ref.current = dependencies
    callback()
  }, dependencies) // eslint-disable-line react-hooks/exhaustive-deps
}
