import { memo, useCallback } from 'react'
import { UpdateRange, Version } from '../../services/types/update'
import TagTooltip from './tag-tooltip'
import { FormatTimeBasedOnYear } from '@/shared/components/format-time-based-on-year'
import HistoryDropdown from './dropdown/history-dropdown'
import HistoryVersionDetails from './history-version-details'
import { LoadedLabel } from '../../services/types/label'
import { useTranslation } from 'react-i18next'
import { ActiveDropdown } from '../../hooks/use-dropdown-active-item'
import { HistoryContextValue } from '../../context/types/history-context-value'
import CompareItems from './dropdown/menu-item/compare-items'
import { ItemSelectionState } from '../../utils/history-details'
import CompareVersionDropdown from './dropdown/compare-version-dropdown'
import { CompareVersionDropdownContentLabelsList } from './dropdown/compare-version-dropdown-content'
import HistoryDropdownContent from '@/features/history/components/change-list/dropdown/history-dropdown-content'
import { bsVersion } from '@/features/utils/bootstrap-5'

type LabelListItemProps = {
  version: Version
  labels: LoadedLabel[]
  currentUserId: string
  projectId: string
  selectionState: ItemSelectionState
  selectable: boolean
  setSelection: HistoryContextValue['setSelection']
  dropdownOpen: boolean
  dropdownActive: boolean
  compareDropdownOpen: boolean
  compareDropdownActive: boolean
  setActiveDropdownItem: ActiveDropdown['setActiveDropdownItem']
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function LabelListItem({
  version,
  labels,
  currentUserId,
  projectId,
  selectionState,
  selectable,
  setSelection,
  dropdownOpen,
  dropdownActive,
  compareDropdownOpen,
  compareDropdownActive,
  setActiveDropdownItem,
  closeDropdownForItem,
}: LabelListItemProps) {
  const { t } = useTranslation()

  // first label
  const fromVTimestamp = Date.parse(labels[labels.length - 1].created_at)
  // most recent label
  const toVTimestamp = Date.parse(labels[0].created_at)

  const updateRange: UpdateRange = {
    fromV: version,
    toV: version,
    fromVTimestamp,
    toVTimestamp,
  }

  const setIsOpened = useCallback(
    (isOpened: boolean) => {
      setActiveDropdownItem({
        item: version,
        isOpened,
        whichDropDown: 'moreOptions',
      })
    },
    [setActiveDropdownItem, version]
  )
  const closeDropdown = useCallback(() => {
    closeDropdownForItem(version, 'moreOptions')
  }, [closeDropdownForItem, version])

  return (
    <HistoryVersionDetails
      key={version}
      updateRange={updateRange}
      selectionState={selectionState}
      selectable={selectable}
      setSelection={setSelection}
    >
      <HistoryDropdown
        id={version.toString()}
        isOpened={dropdownOpen}
        setIsOpened={setIsOpened}
      >
        {dropdownActive ? (
          <HistoryDropdownContent
            version={version}
            projectId={projectId}
            closeDropdownForItem={closeDropdownForItem}
            endTimestamp={toVTimestamp}
          />
        ) : null}
      </HistoryDropdown>
      {selectionState !== 'selected' ? (
        <div
          data-testid="compare-icon-version"
          className={bsVersion({ bs3: 'pull-right', bs5: 'float-end' })}
        >
          {selectionState !== 'withinSelected' ? (
            <CompareItems
              updateRange={updateRange}
              selectionState={selectionState}
              closeDropdown={closeDropdown}
            />
          ) : (
            <CompareVersionDropdown
              id={version.toString()}
              isOpened={compareDropdownOpen}
              setIsOpened={(isOpened: boolean) =>
                setActiveDropdownItem({
                  item: version,
                  isOpened,
                  whichDropDown: 'compare',
                })
              }
            >
              {compareDropdownActive ? (
                <CompareVersionDropdownContentLabelsList
                  version={version}
                  closeDropdownForItem={closeDropdownForItem}
                  versionTimestamp={toVTimestamp}
                />
              ) : null}
            </CompareVersionDropdown>
          )}
        </div>
      ) : null}

      <div className="history-version-main-details">
        {labels.map(label => (
          <div key={label.id} className="history-version-label">
            <TagTooltip
              showTooltip
              currentUserId={currentUserId}
              label={label}
            />
            {label.lastUpdatedTimestamp && (
              <time
                className="history-version-metadata-time"
                data-testid="history-version-metadata-time"
              >
                {t('last_edit')}{' '}
                <FormatTimeBasedOnYear date={label.lastUpdatedTimestamp} />
              </time>
            )}
          </div>
        ))}
      </div>
    </HistoryVersionDetails>
  )
}

export default memo(LabelListItem)
