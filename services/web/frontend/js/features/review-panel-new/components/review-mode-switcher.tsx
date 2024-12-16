import { forwardRef, memo, MouseEventHandler } from 'react'
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

type Mode = 'viewing' | 'reviewing' | 'editing'

const useCurrentMode = (): Mode => {
  const trackChanges = useTrackChangesStateContext()
  const user = useUserContext()
  const trackChangesForCurrentUser =
    trackChanges?.onForEveryone ||
    (user && user.id && trackChanges?.onForMembers[user.id])
  const { write, trackedWrite } = usePermissionsContext()

  if (write && !trackChangesForCurrentUser) {
    return 'editing'
  } else if (trackedWrite) {
    return 'reviewing'
  }

  return 'viewing'
}

function ReviewModeSwitcher() {
  const { t } = useTranslation()
  const { saveTrackChangesForCurrentUser } =
    useTrackChangesStateActionsContext()
  const mode = useCurrentMode()

  const { write, trackedWrite } = usePermissionsContext()
  const showViewOption = !trackedWrite

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
              saveTrackChangesForCurrentUser(false)
            }}
            description={t('can_edit_content')}
            leadingIcon="edit"
            active={write && mode === 'editing'}
          >
            {t('editing')}
          </OLDropdownMenuItem>
          <OLDropdownMenuItem
            disabled={!trackedWrite}
            onClick={() => {
              saveTrackChangesForCurrentUser(true)
            }}
            description={t('can_add_tracked_changes_and_comments')}
            leadingIcon="rate_review"
            active={trackedWrite && mode === 'reviewing'}
          >
            {t('reviewing')}
          </OLDropdownMenuItem>
          {showViewOption && (
            <OLDropdownMenuItem
              onClick={() => {
                saveTrackChangesForCurrentUser(true)
              }}
              description={t('can_view_content')}
              leadingIcon="visibility"
              active={mode === 'viewing'}
            >
              {t('viewing')}
            </OLDropdownMenuItem>
          )}
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}

const ModeSwitcherToggleButton = forwardRef<
  HTMLButtonElement,
  { onClick: MouseEventHandler<HTMLButtonElement>; 'aria-expanded': boolean }
>(({ onClick, 'aria-expanded': ariaExpanded }, ref) => {
  const { t } = useTranslation()
  const mode = useCurrentMode()

  if (mode === 'editing') {
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
  } else if (mode === 'reviewing') {
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
