import { useTranslation } from 'react-i18next'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import Compare from './compare'
import { updateRangeUnion } from '../../../../utils/range'
import MaterialIcon from '../../../../../../shared/components/material-icon'

type CompareItemsProps = {
  updateRange: UpdateRange
  selected: boolean
  closeDropdown: () => void
}

function CompareItems({
  updateRange,
  selected,
  closeDropdown,
}: CompareItemsProps) {
  const { t } = useTranslation()
  const { selection } = useHistoryContext()
  const { updateRange: selRange, comparing } = selection

  // Comparing mode variables
  const notASelectionBoundaryComparingMode =
    !!selRange &&
    comparing &&
    updateRange.toV !== selRange.toV &&
    updateRange.fromV !== selRange.fromV
  const showCompareWithSelected = !comparing && !!selRange && !selected
  const showCompareToThisComparingMode =
    notASelectionBoundaryComparingMode && updateRange.toV > selRange.toV
  const showCompareFromThisComparingMode =
    notASelectionBoundaryComparingMode && updateRange.fromV < selRange.fromV

  // Normal mode variables
  const notASelectionBoundaryNormalMode =
    !!selRange &&
    updateRange.toV !== selRange.toV &&
    updateRange.fromV !== selRange.fromV
  const showCompareToThisNormalMode =
    notASelectionBoundaryNormalMode && updateRange.toV > selRange.toV
  const showCompareFromThisNormalMode =
    notASelectionBoundaryNormalMode && updateRange.fromV < selRange.fromV

  let iconTypeNonSelectedVersion = ''
  let toolTipDescriptionNonSelectedVersion = ''

  if (showCompareToThisNormalMode) {
    iconTypeNonSelectedVersion = 'align_start'
    toolTipDescriptionNonSelectedVersion = t(
      'history_compare_up_to_this_version'
    )
  }
  if (showCompareFromThisNormalMode) {
    iconTypeNonSelectedVersion = 'align_end'
    toolTipDescriptionNonSelectedVersion = t(
      'history_compare_from_this_version'
    )
  }

  return (
    <>
      {showCompareWithSelected ? (
        <Compare
          comparisonRange={updateRangeUnion(updateRange, selRange)}
          closeDropdown={closeDropdown}
          toolTipDescription={toolTipDescriptionNonSelectedVersion}
          icon={
            <MaterialIcon
              type={iconTypeNonSelectedVersion}
              className="material-symbols-rounded history-dropdown-icon p-1"
            />
          }
        />
      ) : null}
      {showCompareFromThisComparingMode ? (
        <Compare
          comparisonRange={{
            fromV: updateRange.fromV,
            toV: selRange.toV,
            fromVTimestamp: updateRange.fromVTimestamp,
            toVTimestamp: selRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          toolTipDescription={t('history_compare_from_this_version')}
          icon={
            <MaterialIcon
              type="align_end"
              className="material-symbols-rounded history-dropdown-icon p-1"
            />
          }
        />
      ) : null}
      {showCompareToThisComparingMode ? (
        <Compare
          comparisonRange={{
            fromV: selRange.fromV,
            toV: updateRange.toV,
            fromVTimestamp: selRange.fromVTimestamp,
            toVTimestamp: updateRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          toolTipDescription={t('history_compare_up_to_this_version')}
          icon={
            <MaterialIcon
              type="align_start"
              className="material-symbols-rounded history-dropdown-icon p-1"
            />
          }
        />
      ) : null}
    </>
  )
}

export default CompareItems
