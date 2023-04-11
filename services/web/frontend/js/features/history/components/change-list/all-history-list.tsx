import { Fragment } from 'react'
import { useHistoryContext } from '../../context/history-context'
import HistoryVersion from './history-version'

function AllHistoryList() {
  const { updates } = useHistoryContext()

  return (
    <>
      {updates.map((update, index) => (
        <Fragment key={`${update.fromV}_${update.toV}`}>
          {update.meta.first_in_day && index > 0 && (
            <hr className="history-version-divider" />
          )}
          <HistoryVersion update={update} />
        </Fragment>
      ))}
    </>
  )
}

export default AllHistoryList
