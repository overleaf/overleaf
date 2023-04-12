import TagTooltip from './tag-tooltip'
import Changes from './changes'
import MetadataUsersList from './metadata-users-list'
import Origin from './origin'
import { useUserContext } from '../../../../shared/context/user-context'
import { relativeDate, formatTime } from '../../../utils/format-date'
import { orderBy } from 'lodash'
import { LoadedUpdate } from '../../services/types/update'

type HistoryEntryProps = {
  update: LoadedUpdate
}

function HistoryVersion({ update }: HistoryEntryProps) {
  const { id: currentUserId } = useUserContext()
  const orderedLabels = orderBy(update.labels, ['created_at'], ['desc'])

  return (
    <div>
      {update.meta.first_in_day && (
        <time className="history-version-day">
          {relativeDate(update.meta.end_ts)}
        </time>
      )}
      <div className="history-version-details">
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
      </div>
    </div>
  )
}

export default HistoryVersion
