import {
  useRef,
  useCallback,
  memo,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { Popover, Overlay } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import Close from '../../../../shared/components/close'
import MaterialIcon from '../../../../shared/components/material-icon'
import HistoryVersionDetails from './history-version-details'
import TagTooltip from './tag-tooltip'
import Changes from './changes'
import MetadataUsersList from './metadata-users-list'
import Origin from './origin'
import HistoryDropdown from './dropdown/history-dropdown'
import { formatTime, relativeDate } from '../../../utils/format-date'
import { orderBy } from 'lodash'
import { LoadedUpdate } from '../../services/types/update'
import classNames from 'classnames'
import {
  updateRangeForUpdate,
  ItemSelectionState,
} from '../../utils/history-details'
import { ActiveDropdown } from '../../hooks/use-dropdown-active-item'
import useAsync from '../../../../shared/hooks/use-async'
import { HistoryContextValue } from '../../context/types/history-context-value'
import VersionDropdownContent from './dropdown/version-dropdown-content'
import CompareItems from './dropdown/menu-item/compare-items'
import { completeHistoryTutorial } from '../../services/api'
import CompareVersionDropdown from './dropdown/compare-version-dropdown'
import { CompareVersionDropdownContentAllHistory } from './dropdown/compare-version-dropdown-content'

type HistoryVersionProps = {
  update: LoadedUpdate
  currentUserId: string
  projectId: string
  selectable: boolean
  faded: boolean
  showDivider: boolean
  selected: ItemSelectionState
  setSelection: HistoryContextValue['setSelection']
  dropdownOpen: boolean
  dropdownActive: boolean
  compareDropdownOpen: boolean
  compareDropdownActive: boolean
  setActiveDropdownItem: ActiveDropdown['setActiveDropdownItem']
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
  hasTutorialOverlay?: boolean
  completeTutorial: () => void
}

function HistoryVersion({
  update,
  currentUserId,
  projectId,
  selectable,
  faded,
  showDivider,
  selected,
  setSelection,
  dropdownOpen,
  dropdownActive,
  compareDropdownOpen,
  compareDropdownActive,
  setActiveDropdownItem,
  closeDropdownForItem,
  hasTutorialOverlay = false,
  completeTutorial,
}: HistoryVersionProps) {
  const orderedLabels = orderBy(update.labels, ['created_at'], ['desc'])
  const iconRef = useRef<HTMLDivElement>(null)

  const { runAsync } = useAsync()

  const { t } = useTranslation()

  const [popover, setPopover] = useState<ReactNode | null>(null)
  // wait for the layout to settle before showing popover, to avoid a flash/ instant move
  const [layoutSettled, setLayoutSettled] = useState(false)

  const [resizing, setResizing] = useState(false)

  // Determine whether the tutorial popover should be shown or not.
  // This is a slightly unusual pattern, as in theory we could control this via
  // the `show` prop. However we were concerned about the perf impact of every
  // history version having a (hidden) popover that won't ever be triggered.
  useEffect(() => {
    if (iconRef.current && hasTutorialOverlay && layoutSettled && !resizing) {
      const dismissModal = () => {
        completeTutorial()
        runAsync(completeHistoryTutorial()).catch(console.error)
      }

      const compareIcon = (
        <MaterialIcon
          type="align_end"
          className="material-symbols-rounded history-dropdown-icon-inverted"
        />
      )

      setPopover(
        <Overlay
          placement="left"
          show
          target={iconRef.current ?? undefined}
          shouldUpdatePosition
        >
          <Popover
            id="popover-toolbar-overflow"
            title={
              <span>
                {t('react_history_tutorial_title')}{' '}
                <Close variant="dark" onDismiss={() => dismissModal()} />
              </span>
            }
            className="dark-themed"
          >
            <Trans
              i18nKey="react_history_tutorial_content"
              components={[
                compareIcon,
                <a href="https://www.overleaf.com/learn/latex/Using_the_History_feature" />, // eslint-disable-line jsx-a11y/anchor-has-content, react/jsx-key
              ]}
            />
          </Popover>
        </Overlay>
      )
    } else {
      setPopover(null)
    }
  }, [
    hasTutorialOverlay,
    runAsync,
    t,
    layoutSettled,
    completeTutorial,
    resizing,
  ])

  // give the components time to position before showing popover so we dont get a instant position change
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLayoutSettled(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [setLayoutSettled])

  useEffect(() => {
    let timer: number | null = null

    const handleResize = () => {
      // Hide popover when a resize starts, then waiting for a gap of 500ms
      // with no resizes before making it reappear
      if (timer) {
        window.clearTimeout(timer)
      } else {
        setResizing(true)
      }
      timer = window.setTimeout(() => {
        timer = null
        setResizing(false)
      }, 500)
    }

    // only need a listener on the component that actually has the popover
    if (hasTutorialOverlay) {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [hasTutorialOverlay])

  const closeDropdown = useCallback(() => {
    closeDropdownForItem(update, 'moreOptions')
  }, [closeDropdownForItem, update])

  const updateRange = updateRangeForUpdate(update)

  return (
    <>
      {popover}
      {showDivider ? (
        <div
          className={classNames({
            'history-version-divider-container': true,
            'version-element-within-selected ':
              selected === 'withinSelected' || selected === 'selectedEdge',
          })}
        >
          <hr className="history-version-divider" />
        </div>
      ) : null}
      {update.meta.first_in_day ? (
        <div
          className={classNames({
            'version-element-within-selected ':
              selected === 'withinSelected' || selected === 'selectedEdge',
          })}
        >
          <time className="history-version-day">
            {relativeDate(update.meta.end_ts)}
          </time>
        </div>
      ) : null}
      <div
        data-testid="history-version"
        className={classNames({
          'history-version-faded': faded,
        })}
      >
        <HistoryVersionDetails
          selected={selected}
          setSelection={setSelection}
          updateRange={updateRangeForUpdate(update)}
          selectable={selectable}
        >
          {faded ? null : (
            <HistoryDropdown
              id={`${update.fromV}_${update.toV}`}
              isOpened={dropdownOpen}
              setIsOpened={(isOpened: boolean) =>
                setActiveDropdownItem({
                  item: update,
                  isOpened,
                  whichDropDown: 'moreOptions',
                })
              }
            >
              {dropdownActive ? (
                <VersionDropdownContent
                  update={update}
                  projectId={projectId}
                  closeDropdownForItem={closeDropdownForItem}
                />
              ) : null}
            </HistoryDropdown>
          )}

          {selected !== 'selected' ? (
            <div
              data-testid="compare-icon-version"
              className="pull-right"
              ref={iconRef}
            >
              {selected !== 'withinSelected' ? (
                <CompareItems
                  updateRange={updateRange}
                  selected={selected}
                  closeDropdown={closeDropdown}
                />
              ) : (
                <CompareVersionDropdown
                  id={`${update.fromV}_${update.toV}`}
                  isOpened={compareDropdownOpen}
                  setIsOpened={(isOpened: boolean) =>
                    setActiveDropdownItem({
                      item: update,
                      isOpened,
                      whichDropDown: 'compare',
                    })
                  }
                >
                  {compareDropdownActive ? (
                    <CompareVersionDropdownContentAllHistory
                      update={update}
                      closeDropdownForItem={closeDropdownForItem}
                    />
                  ) : null}
                </CompareVersionDropdown>
              )}
            </div>
          ) : null}

          <div className="history-version-main-details">
            <time
              className="history-version-metadata-time"
              data-testid="history-version-metadata-time"
            >
              <b>{formatTime(update.meta.end_ts, 'Do MMMM, h:mm a')}</b>
            </time>
            {orderedLabels.map(label => (
              <TagTooltip
                key={label.id}
                showTooltip
                currentUserId={currentUserId}
                label={label}
              />
            ))}
            <Changes
              pathnames={update.pathnames}
              projectOps={update.project_ops}
            />
            <MetadataUsersList
              users={update.meta.users}
              origin={update.meta.origin}
              currentUserId={currentUserId}
            />
            <Origin origin={update.meta.origin} />
          </div>
        </HistoryVersionDetails>
      </div>
    </>
  )
}

export default memo(HistoryVersion)
