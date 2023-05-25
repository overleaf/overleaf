import { memo, useCallback } from 'react'
import { UpdateRange, Version } from '../../services/types/update'
import TagTooltip from './tag-tooltip'
import { formatTime, isoToUnix } from '../../../utils/format-date'
import { isPseudoLabel } from '../../utils/label'
import UserNameWithColoredBadge from './user-name-with-colored-badge'
import HistoryDropdown from './dropdown/history-dropdown'
import HistoryVersionDetails from './history-version-details'
import { LoadedLabel } from '../../services/types/label'
import { useTranslation } from 'react-i18next'
import { ActiveDropdown } from '../../hooks/use-dropdown-active-item'
import { HistoryContextValue } from '../../context/types/history-context-value'
import LabelDropdownContent from './dropdown/label-dropdown-content'

type LabelListItemProps = {
  version: Version
  labels: LoadedLabel[]
  currentUserId: string
  projectId: string
  selected: boolean
  selectable: boolean
  setSelection: HistoryContextValue['setSelection']
  dropdownOpen: boolean
  dropdownActive: boolean
  setActiveDropdownItem: ActiveDropdown['setActiveDropdownItem']
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function LabelListItem({
  version,
  labels,
  currentUserId,
  projectId,
  selected,
  selectable,
  setSelection,
  dropdownOpen,
  dropdownActive,
  setActiveDropdownItem,
  closeDropdownForItem,
}: LabelListItemProps) {
  const { t } = useTranslation()

  // first label
  const fromVTimestamp = isoToUnix(labels[labels.length - 1].created_at)
  // most recent label
  const toVTimestamp = isoToUnix(labels[0].created_at)

  const updateRange: UpdateRange = {
    fromV: version,
    toV: version,
    fromVTimestamp,
    toVTimestamp,
  }

  const setIsOpened = useCallback(
    (isOpened: boolean) => {
      setActiveDropdownItem({ item: version, isOpened })
    },
    [setActiveDropdownItem, version]
  )

  return (
    <HistoryVersionDetails
      key={version}
      updateRange={updateRange}
      selected={selected}
      selectable={selectable}
      setSelection={setSelection}
    >
      <HistoryDropdown
        id={version.toString()}
        isOpened={dropdownOpen}
        setIsOpened={setIsOpened}
      >
        {dropdownActive ? (
          <LabelDropdownContent
            selected={selected}
            version={version}
            versionTimestamp={toVTimestamp}
            projectId={projectId}
            closeDropdownForItem={closeDropdownForItem}
          />
        ) : null}
      </HistoryDropdown>
      <div className="history-version-main-details">
        {labels.map(label => (
          <div key={label.id} className="history-version-label">
            <TagTooltip
              showTooltip={false}
              currentUserId={currentUserId}
              label={label}
            />
            <time
              className="history-version-metadata-time"
              data-testid="history-version-metadata-time"
            >
              {formatTime(label.created_at, 'Do MMMM, h:mm a')}
            </time>
            {!isPseudoLabel(label) && (
              <div className="history-version-saved-by">
                <span className="history-version-saved-by-label">
                  {t('saved_by')}
                </span>
                <UserNameWithColoredBadge
                  user={{
                    id: label.user_id,
                    displayName: label.user_display_name,
                  }}
                  currentUserId={currentUserId}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </HistoryVersionDetails>
  )
}

export default memo(LabelListItem)
