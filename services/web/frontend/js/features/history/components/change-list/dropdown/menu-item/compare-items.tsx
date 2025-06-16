import { useTranslation } from 'react-i18next'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import Compare from './compare'
import MaterialIcon from '../../../../../../shared/components/material-icon'
import { ItemSelectionState } from '../../../../utils/history-details'

type CompareItemsProps = {
  updateRange: UpdateRange
  selectionState: ItemSelectionState
  closeDropdown: () => void
}

function CompareItems({
  updateRange,
  selectionState,
  closeDropdown,
}: CompareItemsProps) {
  const { t } = useTranslation()
  const { selection } = useHistoryContext()
  const { updateRange: selRange } = selection
  if (selRange === null) {
    return null
  }

  return (
    <>
      {selectionState === 'belowSelected' ? (
        <Compare
          comparisonRange={{
            fromV: updateRange.fromV,
            toV: selRange.toV,
            fromVTimestamp: updateRange.fromVTimestamp,
            toVTimestamp: selRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          tooltipDescription={t('history_compare_from_this_version')}
          icon={
            <MaterialIcon
              type="align_end"
              className="history-dropdown-icon pb-1"
            />
          }
        />
      ) : null}
      {selectionState === 'aboveSelected' ? (
        <Compare
          comparisonRange={{
            fromV: selRange.fromV,
            toV: updateRange.toV,
            fromVTimestamp: selRange.fromVTimestamp,
            toVTimestamp: updateRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          tooltipDescription={t('history_compare_up_to_this_version')}
          icon={
            <MaterialIcon
              type="align_start"
              className="history-dropdown-icon pt-1"
            />
          }
        />
      ) : null}
    </>
  )
}

export default CompareItems
