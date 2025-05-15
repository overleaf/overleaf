import { sendSearchEvent } from '@/features/event-tracking/search-events'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { useLayoutContext } from '@/shared/context/layout-context'
import { closeSearchPanel, SearchQuery } from '@codemirror/search'
import { forwardRef, memo, Ref, useCallback, useEffect, useRef } from 'react'
import { useCodeMirrorViewContext } from './codemirror-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { Overlay, Popover } from 'react-bootstrap'
import Close from '@/shared/components/close'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useEditorContext } from '@/shared/context/editor-context'
import getMeta from '@/utils/meta'

const PROMOTION_SIGNUP_CUT_OFF_DATE = new Date('2025-04-22T00:00:00Z')

export const FullProjectSearchButton = ({ query }: { query: SearchQuery }) => {
  const view = useCodeMirrorViewContext()
  const { t } = useTranslation()
  const { setProjectSearchIsOpen } = useLayoutContext()
  const ref = useRef<HTMLButtonElement>(null)

  const { inactiveTutorials } = useEditorContext()

  const hasCompletedTutorial = inactiveTutorials.includes(
    'full-project-search-promo'
  )

  const { showPopup, tryShowingPopup, hideUntilReload, completeTutorial } =
    useTutorial('full-project-search-promo', {
      name: 'full-project-search-promotion',
    })

  let isEligibleForPromotion = true
  const signUpDateString = getMeta('ol-user')?.signUpDate
  if (!signUpDateString) {
    isEligibleForPromotion = false
  } else {
    const signupDate = new Date(signUpDateString)
    if (signupDate > PROMOTION_SIGNUP_CUT_OFF_DATE) {
      isEligibleForPromotion = false
    }
  }

  const openFullProjectSearch = useCallback(() => {
    setProjectSearchIsOpen(true)
    closeSearchPanel(view)
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('editor:full-project-search', { detail: query })
      )
    }, 200)
  }, [setProjectSearchIsOpen, query, view])

  const onClick = useCallback(() => {
    sendSearchEvent('search-open', {
      searchType: 'full-project',
      method: 'button',
      location: 'search-form',
    })
    openFullProjectSearch()
    if (!hasCompletedTutorial && isEligibleForPromotion) {
      completeTutorial({ action: 'complete', event: 'promo-click' })
    }
  }, [
    completeTutorial,
    openFullProjectSearch,
    hasCompletedTutorial,
    isEligibleForPromotion,
  ])

  return (
    <>
      <OLTooltip
        id="open-full-project-search"
        overlayProps={{ placement: 'bottom' }}
        description={t('search_all_project_files')}
      >
        <OLButton variant="secondary" size="sm" ref={ref} onClick={onClick}>
          <MaterialIcon
            type="manage_search"
            accessibilityLabel={t('search_all_project_files')}
          />
        </OLButton>
      </OLTooltip>
      {!hasCompletedTutorial && isEligibleForPromotion && (
        <PromotionOverlay
          ref={ref}
          showPopup={showPopup}
          tryShowingPopup={tryShowingPopup}
          completeTutorial={completeTutorial}
          hideUntilReload={hideUntilReload}
        />
      )}
    </>
  )
}

type PromotionOverlayProps = {
  showPopup: boolean
  tryShowingPopup: () => void
  completeTutorial: (event: {
    action: 'complete'
    event: 'promo-dismiss'
  }) => void
  hideUntilReload: () => void
}

const PromotionOverlay = forwardRef<HTMLButtonElement, PromotionOverlayProps>(
  function PromotionOverlay(
    props: PromotionOverlayProps,
    ref: Ref<HTMLButtonElement>
  ) {
    if (typeof ref === 'function' || !ref?.current) {
      return null
    }

    return <PromotionContent target={ref.current} {...props} />
  }
)

const PromotionContent = memo(function PromotionContent({
  showPopup,
  tryShowingPopup,
  completeTutorial,
  hideUntilReload,
  target,
}: PromotionOverlayProps & {
  target: HTMLButtonElement
}) {
  const { t } = useTranslation()

  useEffect(() => {
    tryShowingPopup()
  }, [tryShowingPopup])

  const onHide = useCallback(() => {
    hideUntilReload()
  }, [hideUntilReload])

  const onClose = useCallback(() => {
    completeTutorial({
      action: 'complete',
      event: 'promo-dismiss',
    })
  }, [completeTutorial])

  return (
    <Overlay
      placement="top"
      show={showPopup}
      target={target}
      rootClose
      onHide={onHide}
    >
      <Popover>
        <Popover.Body>
          <Close variant="dark" onDismiss={onClose} />
          {t('now_you_can_search_your_whole_project_not_just_this_file')}
        </Popover.Body>
      </Popover>
    </Overlay>
  )
})
