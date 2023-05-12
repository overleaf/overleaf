import HistoryVersionDetails from './history-version-details'
import TagTooltip from './tag-tooltip'
import Changes from './changes'
import MetadataUsersList from './metadata-users-list'
import Origin from './origin'
import HistoryVersionDropdown from './dropdown/history-version-dropdown'
import { useUserContext } from '../../../../shared/context/user-context'
import { useHistoryContext } from '../../context/history-context'
import { isVersionSelected } from '../../utils/history-details'
import { formatTime } from '../../../utils/format-date'
import { orderBy } from 'lodash'
import { LoadedUpdate } from '../../services/types/update'
import classNames from 'classnames'

type HistoryEntryProps = {
  update: LoadedUpdate
  faded: boolean
}

function HistoryVersion({ update, faded }: HistoryEntryProps) {
  const { id: currentUserId } = useUserContext()
  const { projectId, selection } = useHistoryContext()

  const orderedLabels = orderBy(update.labels, ['created_at'], ['desc'])
  const selected = isVersionSelected(selection, update.fromV, update.toV)

  return (
    <div
      data-testid="history-version"
      className={classNames({
        'history-version-faded': faded,
      })}
    >
      <HistoryVersionDetails
        fromV={update.fromV}
        toV={update.toV}
        fromVTimestamp={update.meta.end_ts}
        toVTimestamp={update.meta.end_ts}
        selected={selected}
        selectable={!faded && (selection.comparing || !selected)}
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
        {faded ? null : (
          <HistoryVersionDropdown
            id={`${update.fromV}_${update.toV}`}
            projectId={projectId}
            isComparing={selection.comparing}
            isSelected={selected}
            fromV={update.fromV}
            toV={update.toV}
            updateMetaEndTimestamp={update.meta.end_ts}
          />
        )}
      </HistoryVersionDetails>
    </div>
  )
}

export default HistoryVersion
