import { useHistoryContext } from '../../context/history-context'
import classnames from 'classnames'
import { UpdateRange } from '../../services/types/update'

type HistoryVersionDetailsProps = {
  children: React.ReactNode
  selected: boolean
  selectable: boolean
} & UpdateRange

function HistoryVersionDetails({
  children,
  selected,
  selectable,
  fromV,
  toV,
  fromVTimestamp,
  toVTimestamp,
}: HistoryVersionDetailsProps) {
  const { setSelection } = useHistoryContext()

  const handleSelect = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.closest('.dropdown') && e.currentTarget.contains(target)) {
      setSelection({
        updateRange: { fromV, toV, fromVTimestamp, toVTimestamp },
        comparing: false,
        files: [],
      })
    }
  }

  return (
    // TODO: Sort out accessibility for this
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      className={classnames('history-version-details', {
        'history-version-selected': selected,
        'history-version-selectable': selectable,
      })}
      data-testid="history-version-details"
      onClick={selectable ? handleSelect : undefined}
    >
      {children}
    </div>
  )
}

export default HistoryVersionDetails
