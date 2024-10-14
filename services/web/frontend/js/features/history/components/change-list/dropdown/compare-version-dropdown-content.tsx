import { LoadedUpdate, Version } from '../../../services/types/update'
import { useCallback } from 'react'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'
import { useTranslation } from 'react-i18next'
import { updateRangeForUpdate } from '../../../utils/history-details'
import CompareDropDownItem from './menu-item/compare-dropdown-item'
import { useHistoryContext } from '../../../context/history-context'
import MaterialIcon from '../../../../../shared/components/material-icon'

type VersionDropdownContentAllHistoryProps = {
  update: LoadedUpdate
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function CompareVersionDropdownContentAllHistory({
  update,
  closeDropdownForItem,
}: VersionDropdownContentAllHistoryProps) {
  const updateRange = updateRangeForUpdate(update)

  const closeDropdown = useCallback(() => {
    closeDropdownForItem(update, 'compare')
  }, [closeDropdownForItem, update])

  const { t } = useTranslation()
  const { selection } = useHistoryContext()
  const { updateRange: selRange } = selection
  if (selRange === null) {
    return null
  }
  return (
    <>
      <CompareDropDownItem
        comparisonRange={{
          fromV: selRange.fromV,
          toV: updateRange.toV,
          fromVTimestamp: selRange.fromVTimestamp,
          toVTimestamp: updateRange.toVTimestamp,
        }}
        closeDropdown={closeDropdown}
        text={t('history_compare_up_to_this_version')}
        icon={
          <MaterialIcon type="align_start" className="history-dropdown-icon" />
        }
      />
      <CompareDropDownItem
        comparisonRange={{
          fromV: updateRange.fromV,
          toV: selRange.toV,
          fromVTimestamp: updateRange.fromVTimestamp,
          toVTimestamp: selRange.toVTimestamp,
        }}
        closeDropdown={closeDropdown}
        text={t('history_compare_from_this_version')}
        icon={
          <MaterialIcon type="align_end" className="history-dropdown-icon" />
        }
      />
    </>
  )
}

type VersionDropdownContentLabelsListProps = {
  version: Version
  versionTimestamp: number
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function CompareVersionDropdownContentLabelsList({
  version,
  versionTimestamp,
  closeDropdownForItem,
}: VersionDropdownContentLabelsListProps) {
  const closeDropdownLabels = useCallback(() => {
    closeDropdownForItem(version, 'compare')
  }, [closeDropdownForItem, version])

  const { t } = useTranslation()
  const { selection } = useHistoryContext()
  const { updateRange: selRange } = selection
  if (selRange === null) {
    return null
  }

  return (
    <>
      <CompareDropDownItem
        comparisonRange={{
          fromV: selRange.fromV,
          toV: version,
          fromVTimestamp: selRange.fromVTimestamp,
          toVTimestamp: versionTimestamp,
        }}
        closeDropdown={closeDropdownLabels}
        text={t('history_compare_up_to_this_version')}
        icon={
          <MaterialIcon type="align_start" className="history-dropdown-icon" />
        }
      />
      <CompareDropDownItem
        comparisonRange={{
          fromV: version,
          toV: selRange.toV,
          fromVTimestamp: versionTimestamp,
          toVTimestamp: selRange.toVTimestamp,
        }}
        closeDropdown={closeDropdownLabels}
        text={t('history_compare_from_this_version')}
        icon={
          <MaterialIcon type="align_end" className="history-dropdown-icon" />
        }
      />
    </>
  )
}

export {
  CompareVersionDropdownContentAllHistory,
  CompareVersionDropdownContentLabelsList,
}
