import { FC } from 'react'
import TrackChangesToggle from '@/features/source-editor/components/review-panel/toolbar/track-changes-toggle'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useTranslation } from 'react-i18next'
import {
  useTrackChangesStateActionsContext,
  useTrackChangesStateContext,
} from '../context/track-changes-state-context'
import { useChangesUsersContext } from '../context/changes-users-context'
import { buildName } from '../utils/build-name'

export const ReviewPanelTrackChangesMenu: FC = () => {
  const { t } = useTranslation()
  const permissions = usePermissionsContext()
  const project = useProjectContext()
  const trackChanges = useTrackChangesStateContext()
  const { saveTrackChanges } = useTrackChangesStateActionsContext()
  const changesUsers = useChangesUsersContext()

  if (trackChanges === undefined || !changesUsers) {
    return null
  }

  const { onForEveryone, onForGuests, onForMembers } = trackChanges

  const canToggle = project.features.trackChanges && permissions.write

  return (
    <div className="rp-tc-state">
      <div className="rp-tc-state-item">
        <span className="rp-tc-state-item-name">{t('tc_everyone')}</span>

        <TrackChangesToggle
          id="track-changes-everyone"
          description={t('track_changes_for_everyone')}
          handleToggle={() =>
            saveTrackChanges(onForEveryone ? { on_for: {} } : { on: true })
          }
          value={onForEveryone}
          disabled={!canToggle}
        />
      </div>

      {[project.owner, ...project.members].map(member => {
        const user = changesUsers.get(member._id) ?? member
        const name = buildName(user)

        const value = onForEveryone || onForMembers[member._id] === true

        return (
          <div key={member._id} className="rp-tc-state-item">
            <span className="rp-tc-state-item-name">{name}</span>

            <TrackChangesToggle
              id={`track-changes-${member._id}`}
              description={t('track_changes_for_x', { name })}
              handleToggle={() => {
                saveTrackChanges({
                  on_for: {
                    ...onForMembers,
                    [member._id]: !value,
                  },
                  on_for_guests: onForGuests,
                })
              }}
              value={value}
              disabled={!canToggle || onForEveryone}
            />
          </div>
        )
      })}

      <div className="rp-tc-state-item">
        <span className="rp-tc-state-item-name">{t('tc_guests')}</span>

        <TrackChangesToggle
          id="track-changes-guests"
          description={t('track_changes_for_guests')}
          handleToggle={() =>
            saveTrackChanges({
              on_for: onForMembers,
              on_for_guests: !onForGuests,
            })
          }
          value={onForGuests}
          disabled={!canToggle || onForEveryone}
        />
      </div>
    </div>
  )
}
