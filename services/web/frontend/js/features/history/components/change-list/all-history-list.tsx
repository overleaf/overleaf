import { Fragment, useEffect, useRef, useState } from 'react'
import { useHistoryContext } from '../../context/history-context'
import HistoryVersion from './history-version'
import LoadingSpinner from '../../../../shared/components/loading-spinner'

function AllHistoryList() {
  const { updatesInfo, loadingState, fetchNextBatchOfUpdates } =
    useHistoryContext()
  const { updates, atEnd } = updatesInfo
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null)
  const [bottomVisible, setBottomVisible] = useState(false)

  // Create an intersection observer that watches for any part of an element
  // positioned at the bottom of the list to be visible
  useEffect(() => {
    if (loadingState === 'ready' && !intersectionObserverRef.current) {
      const scroller = scrollerRef.current
      const bottom = bottomRef.current

      if (scroller && bottom) {
        intersectionObserverRef.current = new IntersectionObserver(
          entries => {
            setBottomVisible(entries[0].isIntersecting)
          },
          { root: scroller }
        )

        intersectionObserverRef.current.observe(bottom)

        return () => {
          if (intersectionObserverRef.current) {
            intersectionObserverRef.current.disconnect()
          }
        }
      }
    }
  }, [loadingState])

  useEffect(() => {
    if (!atEnd && loadingState === 'ready' && bottomVisible) {
      fetchNextBatchOfUpdates()
    }
  }, [atEnd, bottomVisible, fetchNextBatchOfUpdates, loadingState])

  // While updates are loading, remove the intersection observer and set
  // bottomVisible to false. This is to avoid loading more updates immediately
  // after rendering the pending updates, which would happen otherwise, because
  // the intersection observer is asynchronous and won't have noticed that the
  // bottom is no longer visible
  useEffect(() => {
    if (loadingState !== 'ready' && intersectionObserverRef.current) {
      setBottomVisible(false)
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect()
        intersectionObserverRef.current = null
      }
    }
  }, [loadingState])

  return (
    <div ref={scrollerRef} className="history-all-versions-scroller">
      <div className="history-all-versions-container">
        <div ref={bottomRef} className="history-versions-bottom" />
        {updates.map((update, index) => (
          <Fragment key={`${update.fromV}_${update.toV}`}>
            {update.meta.first_in_day && index > 0 && (
              <hr className="history-version-divider" />
            )}
            <HistoryVersion update={update} />
          </Fragment>
        ))}
      </div>
      {loadingState === 'ready' ? null : <LoadingSpinner />}
    </div>
  )
}

export default AllHistoryList
