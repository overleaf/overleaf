import { useCallback, memo } from 'react'
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
import { HistoryContextValue } from '../../context/types/history-context-value'
import HistoryDropdownContent from './dropdown/history-dropdown-content'
import CompareItems from './dropdown/menu-item/compare-items'
import CompareVersionDropdown from './dropdown/compare-version-dropdown'
import { CompareVersionDropdownContentAllHistory } from './dropdown/compare-version-dropdown-content'
import FileRestoreChange from './file-restore-change'
import HistoryResyncChange from './history-resync-change'
import ProjectRestoreChange from './project-restore-change'

type HistoryVersionProps = {
  update: LoadedUpdate
  currentUserId: string
  projectId: string
  selectable: boolean
  faded: boolean
  showDivider: boolean
  selectionState: ItemSelectionState
  setSelection: HistoryContextValue['setSelection']
  dropdownOpen: boolean
  dropdownActive: boolean
  compareDropdownOpen: boolean
  compareDropdownActive: boolean
  setActiveDropdownItem: ActiveDropdown['setActiveDropdownItem']
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function HistoryVersion({
  update,
  currentUserId,
  projectId,
  selectable,
  faded,
  showDivider,
  selectionState,
  setSelection,
  dropdownOpen,
  dropdownActive,
  compareDropdownOpen,
  compareDropdownActive,
  setActiveDropdownItem,
  closeDropdownForItem,
}: HistoryVersionProps) {
  const orderedLabels = orderBy(update.labels, ['created_at'], ['desc'])
  const closeDropdown = useCallback(() => {
    closeDropdownForItem(update.toV, 'moreOptions')
  }, [closeDropdownForItem, update])

  const updateRange = updateRangeForUpdate(update)
  return (
    <>
      {showDivider ? (
        <div
          className={classNames({
            'history-version-divider-container': true,
            'version-element-within-selected ':
              selectionState === 'withinSelected' ||
              selectionState === 'lowerSelected',
          })}
        >
          <hr className="history-version-divider" />
        </div>
      ) : null}
      {update.meta.first_in_day ? (
        <div
          className={classNames('history-version-day', {
            'version-element-within-selected':
              selectionState === 'withinSelected' ||
              selectionState === 'lowerSelected',
          })}
        >
          <time>{relativeDate(update.meta.end_ts)}</time>
        </div>
      ) : null}
      <div
        data-testid="history-version"
        className={classNames({
          'history-version-faded': faded,
        })}
      >
        <HistoryVersionDetails
          selectionState={selectionState}
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
                  item: update.toV,
                  isOpened,
                  whichDropDown: 'moreOptions',
                })
              }
            >
              {dropdownActive ? (
                <HistoryDropdownContent
                  version={update.toV}
                  endTimestamp={update.meta.end_ts}
                  projectId={projectId}
                  closeDropdownForItem={closeDropdownForItem}
                />
              ) : null}
            </HistoryDropdown>
          )}

          {selectionState !== 'selected' && !faded ? (
            <div data-testid="compare-icon-version" className="float-end">
              {selectionState !== 'withinSelected' ? (
                <CompareItems
                  updateRange={updateRange}
                  selectionState={selectionState}
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
            <ChangeEntry update={update} />
            {update.meta.origin?.kind !== 'history-resync' ? (
              <>
                <MetadataUsersList
                  users={update.meta.users}
                  origin={update.meta.origin}
                  currentUserId={currentUserId}
                />
                <Origin origin={update.meta.origin} />
              </>
            ) : null}
          </div>
        </HistoryVersionDetails>
      </div>
    </>
  )
}

function ChangeEntry({ update }: { update: LoadedUpdate }) {
  switch (update.meta.origin?.kind) {
    case 'file-restore':
      return <FileRestoreChange origin={update.meta.origin} />
    case 'history-resync':
      return <HistoryResyncChange />
    case 'project-restore':
      return <ProjectRestoreChange origin={update.meta.origin} />
    default:
      return (
        <Changes pathnames={update.pathnames} projectOps={update.project_ops} />
      )
  }
}

export default memo(HistoryVersion)
