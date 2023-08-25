import { useTranslation } from 'react-i18next'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import Compare from './compare'
import MaterialIcon from '../../../../../../shared/components/material-icon'
import { ItemSelectionState } from '../../../../utils/history-details'

type CompareItemsProps = {
  updateRange: UpdateRange
  selected: ItemSelectionState
  text?: string
  closeDropdown: () => void
}

function CompareItems({
  updateRange,
  selected,
  text,
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
      {selected === 'belowSelected' ? (
        <Compare
          comparisonRange={{
            fromV: updateRange.fromV,
            toV: selRange.toV,
            fromVTimestamp: updateRange.fromVTimestamp,
            toVTimestamp: selRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          toolTipDescription={t('history_compare_from_this_version')}
          text={text}
          icon={
            <MaterialIcon
              type="align_end"
              className="history-dropdown-icon p-1"
            />
          }
        />
      ) : null}
      {selected === 'aboveSelected' ? (
        <Compare
          comparisonRange={{
            fromV: selRange.fromV,
            toV: updateRange.toV,
            fromVTimestamp: selRange.fromVTimestamp,
            toVTimestamp: updateRange.toVTimestamp,
          }}
          closeDropdown={closeDropdown}
          toolTipDescription={t('history_compare_up_to_this_version')}
          text={text}
          icon={
            <MaterialIcon
              type="align_start"
              className="history-dropdown-icon p-1"
            />
          }
        />
      ) : null}
    </>
  )
}

export default CompareItems
