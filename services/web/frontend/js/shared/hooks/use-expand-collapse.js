import { useRef, useState, useLayoutEffect } from 'react'
import classNames from 'classnames'

function useExpandCollapse({
  initiallyExpanded = false,
  collapsedSize = '0',
  dimension = 'height',
  classes = {}
} = {}) {
  const ref = useRef()
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded)
  const [size, setSize] = useState()

  useLayoutEffect(
    () => {
      const expandCollapseEl = ref.current
      if (isExpanded) {
        const expandedSize =
          dimension === 'height'
            ? expandCollapseEl.scrollHeight
            : expandCollapseEl.scrollWidth
        setSize(expandedSize)
      } else {
        setSize(collapsedSize)
      }
    },
    [isExpanded]
  )

  const expandableClasses = classNames(
    'expand-collapse-container',
    classes.container,
    !isExpanded ? classes.containerCollapsed : null
  )

  function handleToggle() {
    setIsExpanded(!isExpanded)
  }

  return {
    isExpanded,
    expandableProps: {
      ref,
      style: {
        [dimension === 'height' ? 'height' : 'width']: `${size}px`
      },
      className: expandableClasses
    },
    toggleProps: {
      onClick: handleToggle
    }
  }
}

export default useExpandCollapse
