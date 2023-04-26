import HistoryVersionDetails from './history-version-details'
import TagTooltip from './tag-tooltip'
import Changes from './changes'
import MetadataUsersList from './metadata-users-list'
import Origin from './origin'
import HistoryVersionDropdown from './dropdown/history-version-dropdown'
import { useUserContext } from '../../../../shared/context/user-context'
import { useHistoryContext } from '../../context/history-context'
import { isUpdateSelected } from '../../utils/history-details'
import { relativeDate, formatTime } from '../../../utils/format-date'
import { orderBy } from 'lodash'
import { LoadedUpdate } from '../../services/types/update'

type HistoryEntryProps = {
  update: LoadedUpdate
}

function HistoryVersion({ update }: HistoryEntryProps) {
  const { id: currentUserId } = useUserContext()
  const { projectId, selection } = useHistoryContext()

  const orderedLabels = orderBy(update.labels, ['created_at'], ['desc'])
  const selected = isUpdateSelected({
    fromV: update.fromV,
    toV: update.toV,
    selection,
  })

  return (
    <div>
      {update.meta.first_in_day && (
        <time className="history-version-day">
          {relativeDate(update.meta.end_ts)}
        </time>
      )}
      <HistoryVersionDetails
        fromV={update.fromV}
        toV={update.toV}
        fromVTimestamp={update.meta.end_ts}
        toVTimestamp={update.meta.end_ts}
        selected={selected}
      >
        <div className="history-version-main-details">
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
          <Changes
            pathnames={update.pathnames}
            projectOps={update.project_ops}
          />
          <MetadataUsersList
            users={update.meta.users}
            origin={update.meta.origin}
            currentUserId={currentUserId}
          />
          <Origin origin={update.meta.origin} />
        </div>
        <HistoryVersionDropdown
          id={`${update.fromV}_${update.toV}`}
          projectId={projectId}
          isComparing={selection.comparing}
          isSelected={selected}
          fromV={update.fromV}
          toV={update.toV}
          updateMetaEndTimestamp={update.meta.end_ts}
        />
      </HistoryVersionDetails>
    </div>
  )
}

export default HistoryVersion
