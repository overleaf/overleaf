import { useEffect } from 'react'

function useCollapseHeight(
  elRef: React.MutableRefObject<HTMLElement | null>,
  shouldCollapse: boolean
) {
  useEffect(() => {
    if (elRef.current) {
      const neededHeight = elRef.current.scrollHeight

      if (neededHeight > 0) {
        const height = shouldCollapse ? 0 : neededHeight
        // This might result in a too big height if the element has css prop of
        // `box-sizing` set to `content-box`. To fix that, values of props such as
        // box-sizing, padding and border could be extracted from `height` to compensate.
        elRef.current.style.height = `${height}px`
      } else {
        if (shouldCollapse) {
          elRef.current.style.height = '0'
        }
      }
    }
  }, [elRef, shouldCollapse])
}

export default useCollapseHeight
