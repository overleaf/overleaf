import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

const SCROLL_END_OFFSET = 30

function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

function InfiniteScroll({
  atEnd,
  children,
  className = '',
  fetchData,
  itemCount,
  isLoading
}) {
  const root = useRef(null)

  const prevItemCount = usePrevious(itemCount)

  // we keep the value in a Ref instead of state so it can be safely used in effects
  const scrollBottomRef = React.useRef(0)
  function setScrollBottom(value) {
    scrollBottomRef.current = value
  }

  // position updates are not immediately applied. The DOM frequently can't calculate
  // element bounds after react updates, so it needs some throttling
  function scheduleScrollPositionUpdate(throttle) {
    const timeoutHandler = setTimeout(
      () =>
        (root.current.scrollTop =
          root.current.scrollHeight -
          root.current.clientHeight -
          scrollBottomRef.current),
      throttle
    )
    return () => clearTimeout(timeoutHandler)
  }

  // Repositions the scroll after new items are loaded
  useEffect(
    () => {
      // the first render requires a longer throttling due to slower DOM updates
      const scrollThrottle = prevItemCount === 0 ? 150 : 0
      return scheduleScrollPositionUpdate(scrollThrottle)
    },
    [itemCount, prevItemCount]
  )

  // Repositions the scroll after a window resize
  useEffect(() => {
    let clearScrollPositionUpdate
    const handleResize = () => {
      clearScrollPositionUpdate = scheduleScrollPositionUpdate(400)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (clearScrollPositionUpdate) {
        clearScrollPositionUpdate()
      }
    }
  }, [])

  function onScrollHandler(event) {
    setScrollBottom(
      root.current.scrollHeight -
        root.current.scrollTop -
        root.current.clientHeight
    )
    if (event.target !== event.currentTarget) {
      // Ignore scroll events on nested divs
      // (this check won't be necessary in React 17: https://github.com/facebook/react/issues/15723
      return
    }
    if (shouldFetchData()) {
      fetchData()
    }
  }

  function shouldFetchData() {
    const containerIsLargerThanContent =
      root.current.children[0].clientHeight < root.current.clientHeight
    if (atEnd || isLoading || containerIsLargerThanContent) {
      return false
    } else {
      return root.current.scrollTop < SCROLL_END_OFFSET
    }
  }

  return (
    <div
      ref={root}
      onScroll={onScrollHandler}
      className={`infinite-scroll ${className}`}
    >
      {children}
    </div>
  )
}

InfiniteScroll.propTypes = {
  atEnd: PropTypes.bool,
  children: PropTypes.element.isRequired,
  className: PropTypes.string,
  fetchData: PropTypes.func.isRequired,
  itemCount: PropTypes.number.isRequired,
  isLoading: PropTypes.bool
}

export default InfiniteScroll
