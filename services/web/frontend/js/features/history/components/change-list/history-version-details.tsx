import { useHistoryContext } from '../../context/history-context'
import classnames from 'classnames'
import { UpdateRange } from '../../services/types/update'

type HistoryVersionDetailsProps = {
  children: React.ReactNode
  selected: boolean
} & UpdateRange

function HistoryVersionDetails({
  children,
  selected,
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
        pathname: null,
      })
    }
  }

  return (
    // TODO: Sort out accessibility for this
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      className={classnames('history-version-details', {
        'history-version-selected': selected,
      })}
      data-testid="history-version-details"
      onClick={handleSelect}
    >
      {children}
    </div>
  )
}

export default HistoryVersionDetails
