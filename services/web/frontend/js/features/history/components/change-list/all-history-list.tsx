import { useEffect, useRef, useState } from 'react'
import HistoryVersion from './history-version'
import LoadingSpinner from '../../../../shared/components/loading-spinner'
import { OwnerPaywallPrompt } from './owner-paywall-prompt'
import { NonOwnerPaywallPrompt } from './non-owner-paywall-prompt'
import { isVersionSelected } from '../../utils/history-details'
import { useUserContext } from '../../../../shared/context/user-context'
import useDropdownActiveItem from '../../hooks/use-dropdown-active-item'
import { useHistoryContext } from '../../context/history-context'
import { useEditorContext } from '../../../../shared/context/editor-context'
import OLPopover from '@/features/ui/components/ol/ol-popover'
import OLOverlay from '@/features/ui/components/ol/ol-overlay'
import Close from '@/shared/components/close'
import { Trans, useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useFeatureFlag } from '@/shared/context/split-test-context'

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

  const { inactiveTutorials } = useEditorContext()
  const {
    showPopup: showHistoryTutorial,
    tryShowingPopup: tryShowingHistoryTutorial,
    hideUntilReload: hideHistoryTutorialUntilReload,
    completeTutorial: completeHistoryTutorial,
  } = useTutorial('react-history-buttons-tutorial', {
    name: 'react-history-buttons-tutorial',
  })

  const {
    showPopup: showRestorePromo,
    tryShowingPopup: tryShowingRestorePromo,
    hideUntilReload: hideRestorePromoUntilReload,
    completeTutorial: completeRestorePromo,
  } = useTutorial('history-restore-promo', {
    name: 'history-restore-promo',
  })
  const inFileRestoreSplitTest = useFeatureFlag('revert-file')
  const inProjectRestoreSplitTest = useFeatureFlag('revert-project')

  const hasVisibleUpdates = visibleUpdates.length > 0
  const isMoreThanOneVersion = visibleUpdates.length > 1
  const [layoutSettled, setLayoutSettled] = useState(false)

  // When there is a paywall and only two version's to compare,
  // they are not comparable because the one that has a paywall will not have the compare button
  // so we should not display on-boarding popover in that case
  const isPaywallAndNonComparable =
    visibleUpdates.length === 2 && updatesInfo.freeHistoryLimitHit

  useEffect(() => {
    const hasCompletedHistoryTutorial = inactiveTutorials.includes(
      'react-history-buttons-tutorial'
    )
    const hasCompletedRestorePromotion = inactiveTutorials.includes(
      'history-restore-promo'
    )

    // wait for the layout to settle before showing popover, to avoid a flash/ instant move
    if (!layoutSettled) {
      return
    }
    if (
      !hasCompletedHistoryTutorial &&
      isMoreThanOneVersion &&
      !isPaywallAndNonComparable
    ) {
      tryShowingHistoryTutorial()
    } else if (
      !hasCompletedRestorePromotion &&
      inFileRestoreSplitTest &&
      inProjectRestoreSplitTest &&
      hasVisibleUpdates
    ) {
      tryShowingRestorePromo()
    }
  }, [
    hasVisibleUpdates,
    inFileRestoreSplitTest,
    inProjectRestoreSplitTest,
    tryShowingRestorePromo,
    inactiveTutorials,
    isMoreThanOneVersion,
    isPaywallAndNonComparable,
    layoutSettled,
    tryShowingHistoryTutorial,
  ])

  const { t } = useTranslation()

  let popover = null

  // hiding is different from dismissing, as we wont save a full dismissal to the user
  // meaning the tutorial will show on page reload/ re-navigation
  const hidePopover = () => {
    hideHistoryTutorialUntilReload()
    hideRestorePromoUntilReload()
  }

  if (showHistoryTutorial) {
    popover = (
      <OLOverlay
        placement="left-start"
        show={showHistoryTutorial}
        rootClose
        onHide={hidePopover}
        // using scrollerRef to position the popover in the middle of the viewport
        target={scrollerRef.current}
        // Only used in Bootstrap 5. In Bootstrap 3 this is done with CSS.
        popperConfig={{
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [10, 10],
              },
            },
          ],
        }}
        bs3Props={{ shouldUpdatePosition: true }}
      >
        <OLPopover
          id="popover-react-history-tutorial"
          bs3Props={{ arrowOffsetTop: 10 }}
          title={
            <span>
              {t('react_history_tutorial_title')}{' '}
              <Close
                variant="dark"
                onDismiss={() =>
                  completeHistoryTutorial({
                    event: 'promo-click',
                    action: 'complete',
                  })
                }
              />
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
        </OLPopover>
      </OLOverlay>
    )
  } else if (showRestorePromo) {
    popover = (
      <OLOverlay
        placement="left-start"
        show={showRestorePromo}
        rootClose
        onHide={hidePopover}
        // using scrollerRef to position the popover in the middle of the viewport
        target={scrollerRef.current}
        bs3Props={{ shouldUpdatePosition: true }}
      >
        <OLPopover
          id="popover-history-restore-promo"
          bs3Props={{ arrowOffsetTop: 10 }}
          title={
            <span>
              {t('history_restore_promo_title')}
              <Close
                variant="dark"
                onDismiss={() =>
                  completeRestorePromo({
                    event: 'promo-click',
                    action: 'complete',
                  })
                }
              />
            </span>
          }
          className="dark-themed history-popover"
        >
          <Trans
            i18nKey="history_restore_promo_content"
            components={[
              // eslint-disable-next-line react/jsx-key
              <MaterialIcon
                type="more_vert"
                className="history-restore-promo-icon"
              />,
            ]}
          />
        </OLPopover>
      </OLOverlay>
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
        <div className="history-all-versions-loading">
          <LoadingSpinner />
        </div>
      ) : null}
    </div>
  )
}

export default AllHistoryList
