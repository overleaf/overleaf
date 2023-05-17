import { useEffect, useRef, useState } from 'react'
import HistoryVersion from './history-version'
import LoadingSpinner from '../../../../shared/components/loading-spinner'
import { OwnerPaywallPrompt } from './owner-paywall-prompt'
import { NonOwnerPaywallPrompt } from './non-owner-paywall-prompt'
import { isVersionSelected } from '../../utils/history-details'
import { useUserContext } from '../../../../shared/context/user-context'
import useDropdownActiveItem from '../../hooks/use-dropdown-active-item'
import { useHistoryContext } from '../../context/history-context'

function AllHistoryList() {
  const { id: currentUserId } = useUserContext()
  const {
    projectId,
    updatesInfo,
    fetchNextBatchOfUpdates,
    currentUserIsOwner,
    selection,
    setSelection,
  } = useHistoryContext()
  const {
    visibleUpdateCount,
    updates,
    atEnd,
    loadingState: updatesLoadingState,
  } = updatesInfo
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null)
  const [bottomVisible, setBottomVisible] = useState(false)
  const { activeDropdownItem, setActiveDropdownItem, closeDropdownForItem } =
    useDropdownActiveItem()
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
        {visibleUpdates.map((update, index) => {
          const selected = isVersionSelected(
            selection,
            update.fromV,
            update.toV
          )
          const dropdownActive = update === activeDropdownItem.item
          const showDivider = Boolean(update.meta.first_in_day && index > 0)
          const faded =
            updatesInfo.freeHistoryLimitHit &&
            index === visibleUpdates.length - 1
          const selectable = !faded && (selection.comparing || !selected)

          return (
            <HistoryVersion
              key={`${update.fromV}_${update.toV}`}
              update={update}
              faded={faded}
              showDivider={showDivider}
              setSelection={setSelection}
              selected={selected}
              currentUserId={currentUserId}
              selectable={selectable}
              projectId={projectId}
              setActiveDropdownItem={setActiveDropdownItem}
              closeDropdownForItem={closeDropdownForItem}
              dropdownOpen={activeDropdownItem.isOpened && dropdownActive}
              dropdownActive={dropdownActive}
            />
          )
        })}
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
