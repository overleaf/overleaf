import LabelBadges from './label-badges'
import Changes from './changes'
import MetadataUsersList from './metadata-users-list'
import Origin from './origin'
import { useUserContext } from '../../../../shared/context/user-context'
import { relativeDate, formatTime } from '../../../utils/format-date'
import { LoadedUpdate } from '../../services/types/update'

type HistoryEntryProps = {
  update: LoadedUpdate
}

function HistoryVersion({ update }: HistoryEntryProps) {
  const { id: currentUserId } = useUserContext()

  return (
    <div>
      {update.meta.first_in_day && (
        <time className="history-version-day">
          {relativeDate(update.meta.end_ts)}
        </time>
      )}
      <div className="history-version-details">
        <div>
          <time className="history-version-metadata-time">
            {formatTime(update.meta.end_ts, 'Do MMMM, h:mm a')}
          </time>
          <LabelBadges
            labels={update.labels}
            showTooltip
            currentUserId={currentUserId}
          />
          <Changes
            pathNames={update.pathnames}
            projectOps={update.project_ops}
          />
          <MetadataUsersList
            users={update.meta.users}
            origin={update.meta.origin}
            currentUserId={currentUserId}
          />
          <Origin origin={update.meta.origin} />
        </div>
      </div>
    </div>
  )
}

export default HistoryVersion
