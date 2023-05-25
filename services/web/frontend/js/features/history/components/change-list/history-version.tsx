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
import { updateRangeForUpdate } from '../../utils/history-details'
import { ActiveDropdown } from '../../hooks/use-dropdown-active-item'
import { memo } from 'react'
import { HistoryContextValue } from '../../context/types/history-context-value'
import VersionDropdownContent from './dropdown/version-dropdown-content'

type HistoryVersionProps = {
  update: LoadedUpdate
  currentUserId: string
  projectId: string
  selectable: boolean
  faded: boolean
  showDivider: boolean
  selected: boolean
  setSelection: HistoryContextValue['setSelection']
  dropdownOpen: boolean
  dropdownActive: boolean
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
  selected,
  setSelection,
  dropdownOpen,
  dropdownActive,
  setActiveDropdownItem,
  closeDropdownForItem,
}: HistoryVersionProps) {
  const orderedLabels = orderBy(update.labels, ['created_at'], ['desc'])

  return (
    <>
      {showDivider ? <hr className="history-version-divider" /> : null}
      {update.meta.first_in_day ? (
        <time className="history-version-day">
          {relativeDate(update.meta.end_ts)}
        </time>
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
                setActiveDropdownItem({ item: update, isOpened })
              }
            >
              {dropdownActive ? (
                <VersionDropdownContent
                  selected={selected}
                  update={update}
                  projectId={projectId}
                  closeDropdownForItem={closeDropdownForItem}
                />
              ) : null}
            </HistoryDropdown>
          )}
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
