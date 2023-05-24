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
  const notASelectionBoundary =
    !!selRange &&
    comparing &&
    updateRange.toV !== selRange.toV &&
    updateRange.fromV !== selRange.fromV
  const showCompareWithSelected = !comparing && !!selRange && !selected
  const showCompareToThis =
    notASelectionBoundary && updateRange.toV > selRange.fromV
  const showCompareFromThis =
    notASelectionBoundary && updateRange.fromV < selRange.toV

  return (
    <>
      {showCompareWithSelected ? (
        <Compare
          comparisonRange={updateRangeUnion(updateRange, selRange)}
          closeDropdown={closeDropdown}
          text={t('history_compare_to_selected_version')}
        />
      ) : null}
      {showCompareFromThis ? (
        <Compare
          comparisonRange={{
            fromV: updateRange.fromV,
            toV: selRange.toV,
            fromVTimestamp: updateRange.fromVTimestamp,
            toVTimestamp: selRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          text={t('history_compare_from_this_version')}
          icon={<MaterialIcon type="line_start_circle" className="fa-fw" />}
        />
      ) : null}
      {showCompareToThis ? (
        <Compare
          comparisonRange={{
            fromV: selRange.fromV,
            toV: updateRange.toV,
            fromVTimestamp: selRange.fromVTimestamp,
            toVTimestamp: updateRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          text={t('history_compare_up_to_this_version')}
          icon={<MaterialIcon type="line_end_circle" className="fa-fw" />}
        />
      ) : null}
    </>
  )
}

export default CompareItems
