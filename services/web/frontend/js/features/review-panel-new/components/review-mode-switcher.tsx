import { forwardRef, memo, MouseEventHandler, useRef, useState } from 'react'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import {
  useTrackChangesStateActionsContext,
  useTrackChangesStateContext,
} from '../context/track-changes-state-context'
import { useUserContext } from '@/shared/context/user-context'
import { useTranslation } from 'react-i18next'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import { sendMB } from '@/infrastructure/event-tracking'
import { useEditorContext } from '@/shared/context/editor-context'
import { useProjectContext } from '@/shared/context/project-context'
import UpgradeTrackChangesModal from './upgrade-track-changes-modal'
import { ReviewModePromo } from '@/features/review-panel-new/components/review-mode-promo'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useLayoutContext } from '@/shared/context/layout-context'

type Mode = 'view' | 'review' | 'edit'

const useCurrentMode = (): Mode => {
  const trackChanges = useTrackChangesStateContext()
  const user = useUserContext()
  const trackChangesForCurrentUser =
    trackChanges?.onForEveryone ||
    (user?.id && trackChanges?.onForMembers[user.id]) ||
    (!user?.id && trackChanges?.onForGuests)
  const { permissionsLevel } = useEditorContext()

  if (permissionsLevel === 'readOnly') {
    return 'view'
  } else if (permissionsLevel === 'review') {
    return 'review'
  } else if (trackChangesForCurrentUser) {
    return 'review'
  } else {
    return 'edit'
  }
}

function ReviewModeSwitcher() {
  const { t } = useTranslation()
  const user = useUserContext()
  const { saveTrackChangesForCurrentUser, saveTrackChanges } =
    useTrackChangesStateActionsContext()
  const mode = useCurrentMode()
  const { permissionsLevel } = useEditorContext()
  const { write, trackedWrite } = usePermissionsContext()
  const project = useProjectContext()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const showViewOption = permissionsLevel === 'readOnly'

  return (
    <div className="review-mode-switcher-container">
      <Dropdown className="review-mode-switcher" align="end">
        <DropdownToggle
          as={ModeSwitcherToggleButton}
          id="review-mode-switcher"
        />
        <DropdownMenu flip={false}>
          <OLDropdownMenuItem
            disabled={!write}
            onClick={() => {
              if (mode === 'edit') {
                return
              }
              sendMB('editing-mode-change', {
                role: permissionsLevel,
                previousMode: mode,
                newMode: 'edit',
              })
              if (user?.id) {
                saveTrackChangesForCurrentUser(false)
              } else {
                saveTrackChanges({ on_for_guests: false })
              }
            }}
            description={t('edit_content_directly')}
            leadingIcon="edit"
            active={write && mode === 'edit'}
          >
            {t('editing')}
          </OLDropdownMenuItem>
          <OLDropdownMenuItem
            disabled={permissionsLevel === 'readOnly'}
            onClick={() => {
              if (mode === 'review') {
                return
              }
              if (!project.features.trackChanges) {
                setShowUpgradeModal(true)
              } else {
                sendMB('editing-mode-change', {
                  role: permissionsLevel,
                  previousMode: mode,
                  newMode: 'review',
                })
                if (user?.id) {
                  saveTrackChangesForCurrentUser(true)
                } else {
                  saveTrackChanges({ on_for_guests: true })
                }
              }
            }}
            description={
              permissionsLevel === 'review' && !trackedWrite
                ? t('comment_only')
                : t('edits_become_suggestions')
            }
            leadingIcon="rate_review"
            active={trackedWrite && mode === 'review'}
          >
            {t('reviewing')}
          </OLDropdownMenuItem>
          {showViewOption && (
            <OLDropdownMenuItem
              description={t('can_view_content')}
              leadingIcon="visibility"
              active={mode === 'view'}
            >
              {t('viewing')}
            </OLDropdownMenuItem>
          )}
        </DropdownMenu>
      </Dropdown>
      <UpgradeTrackChangesModal
        show={showUpgradeModal}
        setShow={setShowUpgradeModal}
      />
    </div>
  )
}

const ModeSwitcherToggleButton = forwardRef<
  HTMLButtonElement,
  { onClick: MouseEventHandler<HTMLButtonElement>; 'aria-expanded': boolean }
>(({ onClick, 'aria-expanded': ariaExpanded }, ref) => {
  const { t } = useTranslation()
  const mode = useCurrentMode()

  if (mode === 'edit') {
    return (
      <ModeSwitcherToggleButtonContent
        ref={ref}
        onClick={onClick}
        className="editing"
        iconType="edit"
        label={t('editing')}
        ariaExpanded={ariaExpanded}
        currentMode={mode}
      />
    )
  } else if (mode === 'review') {
    return (
      <ModeSwitcherToggleButtonContent
        ref={ref}
        onClick={onClick}
        className="reviewing"
        iconType="rate_review"
        label={t('reviewing')}
        ariaExpanded={ariaExpanded}
        currentMode={mode}
      />
    )
  }

  return (
    <ModeSwitcherToggleButtonContent
      ref={ref}
      onClick={onClick}
      className="viewing"
      iconType="visibility"
      label={t('viewing')}
      ariaExpanded={ariaExpanded}
      currentMode={mode}
    />
  )
})

const ModeSwitcherToggleButtonContent = forwardRef<
  HTMLButtonElement,
  {
    onClick: MouseEventHandler<HTMLButtonElement>
    className: string
    iconType: string
    label: string
    ariaExpanded: boolean
    currentMode: string
  }
>(({ onClick, className, iconType, label, ariaExpanded, currentMode }, ref) => {
  const [isFirstTimeUsed, setIsFirstTimeUsed] = usePersistedState(
    `modeSwitcherFirstTimeUsed`,
    true
  )

  const tutorialProps = useTutorial('review-mode', {
    name: 'review-mode-notification',
  })

  const user = useUserContext()
  const project = useProjectContext()
  const { reviewPanelOpen } = useLayoutContext()
  const { inactiveTutorials } = useEditorContext()

  const hasCompletedReviewModeTutorial =
    inactiveTutorials.includes('review-mode')

  const canShowReviewModePromo =
    reviewPanelOpen &&
    currentMode !== 'review' &&
    project.features.trackChanges &&
    user.signUpDate &&
    user.signUpDate < '2025-03-15' &&
    !hasCompletedReviewModeTutorial

  const containerRef = useRef<HTMLSpanElement | null>(null)

  return (
    <>
      <span ref={containerRef}>
        <button
          className={classNames(
            'review-mode-switcher-toggle-button',
            className,
            {
              'review-mode-switcher-toggle-button-expanded': isFirstTimeUsed,
            }
          )}
          ref={ref}
          onClick={event => {
            setIsFirstTimeUsed(false)
            if (!hasCompletedReviewModeTutorial) {
              tutorialProps.completeTutorial({
                action: 'complete',
                event: 'promo-click',
              })
            }
            onClick(event)
          }}
          aria-expanded={ariaExpanded}
        >
          <MaterialIcon className="material-symbols-outlined" type={iconType} />
          <div className="review-mode-switcher-toggle-label" aria-label={label}>
            {label}
          </div>
          <MaterialIcon type="keyboard_arrow_down" />
        </button>
      </span>

      {canShowReviewModePromo && (
        <ReviewModePromo target={containerRef} {...tutorialProps} />
      )}
    </>
  )
})

ModeSwitcherToggleButton.displayName = 'ModeSwitcherToggleButton'
ModeSwitcherToggleButtonContent.displayName = 'ModeSwitcherToggleButtonContent'

export default memo(ReviewModeSwitcher)
