import { Fragment, useEffect, useRef, useState } from 'react'
import { useHistoryContext } from '../../context/history-context'
import HistoryVersion from './history-version'
import LoadingSpinner from '../../../../shared/components/loading-spinner'
import { OwnerPaywallPrompt } from './owner-paywall-prompt'
import { NonOwnerPaywallPrompt } from './non-owner-paywall-prompt'
import { relativeDate } from '../../../utils/format-date'

function AllHistoryList() {
  const { updatesInfo, fetchNextBatchOfUpdates, currentUserIsOwner } =
    useHistoryContext()
  const updatesLoadingState = updatesInfo.loadingState
  const { visibleUpdateCount, updates, atEnd } = updatesInfo
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null)
  const [bottomVisible, setBottomVisible] = useState(false)
  const showPaywall =
    updatesLoadingState === 'ready' && updatesInfo.freeHistoryLimitHit
  const showOwnerPaywall = showPaywall && currentUserIsOwner
  const showNonOwnerPaywall = showPaywall && !currentUserIsOwner
  const visibleUpdates =
    visibleUpdateCount === null ? updates : updates.slice(0, visibleUpdateCount)

  // Create an intersection observer that watches for any part of an element
  // positioned at the bottom of the list to be visible
  useEffect(() => {
    if (updatesLoadingState === 'ready' && !intersectionObserverRef.current) {
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
  }, [updatesLoadingState])

  useEffect(() => {
    if (!atEnd && updatesLoadingState === 'ready' && bottomVisible) {
      fetchNextBatchOfUpdates()
    }
  }, [atEnd, bottomVisible, fetchNextBatchOfUpdates, updatesLoadingState])

  // While updates are loading, remove the intersection observer and set
  // bottomVisible to false. This is to avoid loading more updates immediately
  // after rendering the pending updates, which would happen otherwise, because
  // the intersection observer is asynchronous and won't have noticed that the
  // bottom is no longer visible
  useEffect(() => {
    if (updatesLoadingState !== 'ready' && intersectionObserverRef.current) {
      setBottomVisible(false)
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect()
        intersectionObserverRef.current = null
      }
    }
  }, [updatesLoadingState])

  return (
    <div ref={scrollerRef} className="history-all-versions-scroller">
      <div className="history-all-versions-container">
        <div ref={bottomRef} className="history-versions-bottom" />
        {visibleUpdates.map((update, index) => (
          <Fragment key={`${update.fromV}_${update.toV}`}>
            {update.meta.first_in_day && index > 0 && (
              <hr className="history-version-divider" />
            )}
            {update.meta.first_in_day && (
              <time className="history-version-day">
                {relativeDate(update.meta.end_ts)}
              </time>
            )}
            <HistoryVersion
              update={update}
              faded={
                updatesInfo.freeHistoryLimitHit &&
                index === visibleUpdates.length - 1
              }
            />
          </Fragment>
        ))}
      </div>
      {showOwnerPaywall ? <OwnerPaywallPrompt /> : null}
      {showNonOwnerPaywall ? <NonOwnerPaywallPrompt /> : null}
      {updatesLoadingState === 'loadingInitial' ||
      updatesLoadingState === 'loadingUpdates' ? (
        <LoadingSpinner />
      ) : null}
    </div>
  )
}

export default AllHistoryList
