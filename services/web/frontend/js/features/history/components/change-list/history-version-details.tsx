import classnames from 'classnames'
import { HistoryContextValue } from '../../context/types/history-context-value'
import { UpdateRange } from '../../services/types/update'
import { ReactNode, MouseEvent } from 'react'
import { ItemSelectionState } from '../../utils/history-details'

type HistoryVersionDetailsProps = {
  children: ReactNode
  updateRange: UpdateRange
  selected: ItemSelectionState
  selectable: boolean
  setSelection: HistoryContextValue['setSelection']
}

function HistoryVersionDetails({
  children,
  selected,
  updateRange,
  selectable,
  setSelection,
}: HistoryVersionDetailsProps) {
  const handleSelect = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.closest('.dropdown') && e.currentTarget.contains(target)) {
      setSelection(({ previouslySelectedPathname }) => ({
        updateRange,
        comparing: false,
        files: [],
        previouslySelectedPathname,
      }))
    }
  }

  return (
    // TODO: Sort out accessibility for this
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      className={classnames('history-version-details clearfix', {
        'history-version-selected':
          selected === 'selectedEdge' || selected === 'selected',
        'history-version-within-selected': selected === 'withinSelected',
        'history-version-selectable': selectable,
      })}
      data-testid="history-version-details"
      data-selected={selected}
      onClick={selectable ? handleSelect : undefined}
    >
      {children}
    </div>
  )
}

export default HistoryVersionDetails
