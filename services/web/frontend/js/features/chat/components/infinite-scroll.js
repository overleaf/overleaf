import React, { useRef, useEffect, useLayoutEffect } from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'

const SCROLL_END_OFFSET = 30

function InfiniteScroll({
  atEnd,
  children,
  className = '',
  fetchData,
  itemCount,
  isLoading
}) {
  const root = useRef(null)

  // we keep the value in a Ref instead of state so it can be safely used in effects
  const scrollBottomRef = useRef(0)
  function setScrollBottom(value) {
    scrollBottomRef.current = value
  }

  function updateScrollPosition() {
    root.current.scrollTop =
      root.current.scrollHeight -
      root.current.clientHeight -
      scrollBottomRef.current
  }

  // Repositions the scroll after new items are loaded
  useLayoutEffect(updateScrollPosition, [itemCount])

  // Repositions the scroll after a window resize
  useEffect(() => {
    const handleResize = _.debounce(updateScrollPosition, 400)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
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
