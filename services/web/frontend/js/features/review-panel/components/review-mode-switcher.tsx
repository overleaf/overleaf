import { forwardRef, memo, MouseEventHandler, useState } from 'react'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
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
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useProjectContext } from '@/shared/context/project-context'
import UpgradeTrackChangesModal from './upgrade-track-changes-modal'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'

type Mode = 'view' | 'review' | 'edit'

const useCurrentMode = (): Mode => {
  const trackChanges = useTrackChangesStateContext()
  const user = useUserContext()
  const trackChangesForCurrentUser =
    trackChanges?.onForEveryone ||
    (user?.id && trackChanges?.onForMembers[user.id]) ||
    (!user?.id && trackChanges?.onForGuests)
  const { permissionsLevel } = useIdeReactContext()

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
  const { permissionsLevel } = useIdeReactContext()
  const { write, trackedWrite } = usePermissionsContext()
  const { features } = useProjectContext()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const showViewOption = permissionsLevel === 'readOnly'
  const view = useCodeMirrorViewContext()

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
                view.focus()
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
              view.focus()
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
                view.focus()
                return
              }
              if (!features.trackChanges) {
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
                view.focus()
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
  }
>(({ onClick, className, iconType, label, ariaExpanded }, ref) => {
  const [isFirstTimeUsed, setIsFirstTimeUsed] = usePersistedState(
    `modeSwitcherFirstTimeUsed`,
    true
  )

  return (
    <button
      className={classNames('review-mode-switcher-toggle-button', className, {
        'review-mode-switcher-toggle-button-expanded': isFirstTimeUsed,
      })}
      ref={ref}
      onClick={event => {
        setIsFirstTimeUsed(false)
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
  )
})

ModeSwitcherToggleButton.displayName = 'ModeSwitcherToggleButton'
ModeSwitcherToggleButtonContent.displayName = 'ModeSwitcherToggleButtonContent'

export default memo(ReviewModeSwitcher)
