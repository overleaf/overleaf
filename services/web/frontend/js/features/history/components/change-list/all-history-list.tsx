import { useCallback, useEffect, useRef, useState } from 'react'
import HistoryVersion from './history-version'
import LoadingSpinner from '../../../../shared/components/loading-spinner'
import { OwnerPaywallPrompt } from './owner-paywall-prompt'
import { NonOwnerPaywallPrompt } from './non-owner-paywall-prompt'
import { isVersionSelected } from '../../utils/history-details'
import { useUserContext } from '../../../../shared/context/user-context'
import useDropdownActiveItem from '../../hooks/use-dropdown-active-item'
import { useHistoryContext } from '../../context/history-context'
import { useEditorContext } from '../../../../shared/context/editor-context'
import { Overlay, Popover } from 'react-bootstrap'
import Close from '@/shared/components/close'
import { Trans, useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import useAsync from '@/shared/hooks/use-async'
import { completeHistoryTutorial } from '../../services/api'
import { debugConsole } from '@/utils/debugging'

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

  const { inactiveTutorials, deactivateTutorial } = useEditorContext()

  const [showPopover, setShowPopover] = useState(() => {
    // only show tutorial popover if they haven't dismissed ("completed") it yet
    return !inactiveTutorials.includes('react-history-buttons-tutorial')
  })

  const completeTutorial = useCallback(() => {
    setShowPopover(false)
    deactivateTutorial('react-history-buttons-tutorial')
  }, [deactivateTutorial])

  const { runAsync } = useAsync()

  const { t } = useTranslation()

  // wait for the layout to settle before showing popover, to avoid a flash/ instant move
  const [layoutSettled, setLayoutSettled] = useState(false)

  // When there is a paywall and only two version's to compare,
  // they are not comparable because the one that has a paywall will not have the compare button
  // so we should not display on-boarding popover in that case
  const isPaywallAndNonComparable =
    visibleUpdates.length === 2 && updatesInfo.freeHistoryLimitHit

  const isMoreThanOneVersion = visibleUpdates.length > 1
  let popover = null

  // hiding is different from dismissing, as we wont save a full dismissal to the user
  // meaning the tutorial will show on page reload/ re-navigation
  const hidePopover = () => {
    completeTutorial()
  }

  if (
    isMoreThanOneVersion &&
    showPopover &&
    !isPaywallAndNonComparable &&
    layoutSettled
  ) {
    const dismissModal = () => {
      completeTutorial()
      runAsync(completeHistoryTutorial()).catch(debugConsole.error)
    }

    popover = (
      <Overlay
        placement="left"
        show={showPopover}
        rootClose
        onHide={hidePopover}
        // using scrollerRef to position the popover in the middle of the viewport
        target={scrollerRef.current ?? undefined}
        shouldUpdatePosition
      >
        <Popover
          id="popover-toolbar-overflow"
          arrowOffsetTop={10}
          title={
            <span>
              {t('react_history_tutorial_title')}{' '}
              <Close variant="dark" onDismiss={() => dismissModal()} />
            </span>
          }
          className="dark-themed history-popover"
        >
          <Trans
            i18nKey="react_history_tutorial_content"
            components={[
              // eslint-disable-next-line react/jsx-key
              <MaterialIcon
                type="align_end"
                className="history-dropdown-icon-inverted"
              />,
              <a href="https://www.overleaf.com/learn/latex/Using_the_History_feature" />, // eslint-disable-line jsx-a11y/anchor-has-content, react/jsx-key
            ]}
          />
        </Popover>
      </Overlay>
    )
  }

  // give the components time to position before showing popover so we don't get an instant position change
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLayoutSettled(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [setLayoutSettled])

  // resizes can cause the popover to point to the wrong thing, since it changes the horizontal layout of the page
  useEffect(() => {
    window.addEventListener('resize', hidePopover)
    return () => window.removeEventListener('resize', hidePopover)
  })

  return (
    <div ref={scrollerRef} className="history-all-versions-scroller">
      {popover}
      <div className="history-all-versions-container">
        <div ref={bottomRef} className="history-versions-bottom" />
        {visibleUpdates.map((update, index) => {
          const selectionState = isVersionSelected(
            selection,
            update.fromV,
            update.toV
          )
          const dropdownActive =
            update.toV === activeDropdownItem.item &&
            activeDropdownItem.whichDropDown === 'moreOptions'
          const compareDropdownActive =
            update === activeDropdownItem.item &&
            activeDropdownItem.whichDropDown === 'compare'
          const showDivider = Boolean(update.meta.first_in_day && index > 0)
          const faded =
            updatesInfo.freeHistoryLimitHit &&
            index === visibleUpdates.length - 1 &&
            visibleUpdates.length > 1
          const selectable =
            !faded &&
            (selection.comparing ||
              selectionState === 'aboveSelected' ||
              selectionState === 'belowSelected')

          return (
            <HistoryVersion
              key={`${update.fromV}_${update.toV}`}
              update={update}
              faded={faded}
              showDivider={showDivider}
              setSelection={setSelection}
              selectionState={selectionState}
              currentUserId={currentUserId!}
              selectable={selectable}
              projectId={projectId}
              setActiveDropdownItem={setActiveDropdownItem}
              closeDropdownForItem={closeDropdownForItem}
              dropdownOpen={activeDropdownItem.isOpened && dropdownActive}
              compareDropdownActive={compareDropdownActive}
              compareDropdownOpen={
                activeDropdownItem.isOpened && compareDropdownActive
              }
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
