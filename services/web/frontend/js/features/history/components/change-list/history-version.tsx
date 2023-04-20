import TagTooltip from './tag-tooltip'
import Changes from './changes'
import MetadataUsersList from './metadata-users-list'
import Origin from './origin'
import { useUserContext } from '../../../../shared/context/user-context'
import { relativeDate, formatTime } from '../../../utils/format-date'
import { orderBy } from 'lodash'
import { LoadedUpdate } from '../../services/types/update'
import { useHistoryContext } from '../../context/history-context'
import classNames from 'classnames'
import { updateIsSelected } from '../../utils/history-details'

type HistoryEntryProps = {
  update: LoadedUpdate
}

function HistoryVersion({ update }: HistoryEntryProps) {
  const { id: currentUserId } = useUserContext()
  const orderedLabels = orderBy(update.labels, ['created_at'], ['desc'])

  const { selection, setSelection } = useHistoryContext()

  const selected = updateIsSelected({
    fromV: update.fromV,
    toV: update.toV,
    selection,
  })

  function compare() {
    const { updateRange } = selection
    if (!updateRange) {
      return
    }
    const fromV = Math.min(update.fromV, updateRange.fromV)
    const toV = Math.max(update.toV, updateRange.toV)
    const fromVTimestamp = Math.min(
      update.meta.end_ts,
      updateRange.fromVTimestamp
    )
    const toVTimestamp = Math.max(update.meta.end_ts, updateRange.toVTimestamp)

    setSelection({
      updateRange: { fromV, toV, fromVTimestamp, toVTimestamp },
      comparing: true,
      files: [],
      pathname: null,
    })
  }

  return (
    <div className={classNames({ 'history-version-selected': selected })}>
      {update.meta.first_in_day && (
        <time className="history-version-day">
          {relativeDate(update.meta.end_ts)}
        </time>
      )}
      {/* TODO: Sort out accessibility for this */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
      <div
        className="history-version-details"
        data-testid="history-version-details"
        onClick={() =>
          setSelection({
            updateRange: {
              fromV: update.fromV,
              toV: update.toV,
              fromVTimestamp: update.meta.end_ts,
              toVTimestamp: update.meta.end_ts,
            },
            comparing: false,
            files: [],
            pathname: null,
          })
        }
      >
        <time className="history-version-metadata-time">
          <b>{formatTime(update.meta.end_ts, 'Do MMMM, h:mm a')}</b>
        </time>
        {orderedLabels.map(label => (
          <TagTooltip
            key={label.id}
            showTooltip
            currentUserId={currentUserId}
            label={label}
          />
        ))}
        <Changes pathnames={update.pathnames} projectOps={update.project_ops} />
        <MetadataUsersList
          users={update.meta.users}
          origin={update.meta.origin}
          currentUserId={currentUserId}
        />
        <Origin origin={update.meta.origin} />
        {selection.comparing ? null : (
          <div>
            <button
              onClick={event => {
                event.stopPropagation()
                compare()
              }}
            >
              Compare
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryVersion
