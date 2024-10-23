import { useTranslation } from 'react-i18next'
import TrackChangesToggle from '@/features/source-editor/components/review-panel/toolbar/track-changes-toggle'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '@/features/source-editor/context/review-panel/review-panel-context'
import { useProjectContext } from '@/shared/context/project-context'
import classnames from 'classnames'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

function TrackChangesMenu() {
  const { t } = useTranslation()
  const project = useProjectContext()
  const {
    toggleTrackChangesForEveryone,
    toggleTrackChangesForUser,
    toggleTrackChangesForGuests,
  } = useReviewPanelUpdaterFnsContext()
  const {
    permissions,
    trackChangesState,
    trackChangesOnForEveryone,
    trackChangesOnForGuests,
    trackChangesForGuestsAvailable,
    formattedProjectMembers,
  } = useReviewPanelValueContext()

  return (
    <ul className="rp-tc-state" data-testid="review-panel-track-changes-menu">
      <li className="rp-tc-state-item rp-tc-state-item-everyone">
        <OLTooltip
          description={t('tc_switch_everyone_tip')}
          id="track-changes-switch-everyone"
          overlayProps={{
            container: document.body,
            placement: 'left',
            delay: 1000,
          }}
        >
          <span className="rp-tc-state-item-name">{t('tc_everyone')}</span>
        </OLTooltip>

        <TrackChangesToggle
          id="track-changes-everyone"
          description={t('track_changes_for_everyone')}
          handleToggle={() =>
            toggleTrackChangesForEveryone(!trackChangesOnForEveryone)
          }
          value={trackChangesOnForEveryone}
          disabled={!project.features.trackChanges || !permissions.write}
        />
      </li>
      {Object.values(formattedProjectMembers).map(member => (
        <li className="rp-tc-state-item" key={member.id}>
          <OLTooltip
            description={t('tc_switch_user_tip')}
            id="track-changes-switch-user"
            overlayProps={{
              container: document.body,
              placement: 'left',
              delay: 1000,
            }}
          >
            <span
              className={classnames('rp-tc-state-item-name', {
                'rp-tc-state-item-name-disabled': trackChangesOnForEveryone,
              })}
            >
              {member.name}
            </span>
          </OLTooltip>

          <TrackChangesToggle
            id={`track-changes-user-toggle-${member.id}`}
            description={t('track_changes_for_x', { name: member.name })}
            handleToggle={() =>
              toggleTrackChangesForUser(
                !trackChangesState[member.id]?.value,
                member.id
              )
            }
            value={Boolean(trackChangesState[member.id]?.value)}
            disabled={
              trackChangesOnForEveryone ||
              !project.features.trackChanges ||
              !permissions.write
            }
          />
        </li>
      ))}
      <li className="rp-tc-state-separator" />
      <li className="rp-tc-state-item">
        <OLTooltip
          description={t('tc_switch_guests_tip')}
          id="track-changes-switch-guests"
          overlayProps={{
            container: document.body,
            placement: 'left',
            delay: 1000,
          }}
        >
          <span
            className={classnames('rp-tc-state-item-name', {
              'rp-tc-state-item-name-disabled': trackChangesOnForEveryone,
            })}
          >
            {t('tc_guests')}
          </span>
        </OLTooltip>

        <TrackChangesToggle
          id="track-changes-guests-toggle"
          description="Track changes for guests"
          handleToggle={() =>
            toggleTrackChangesForGuests(!trackChangesOnForGuests)
          }
          value={trackChangesOnForGuests}
          disabled={
            trackChangesOnForEveryone ||
            !project.features.trackChanges ||
            !permissions.write ||
            !trackChangesForGuestsAvailable
          }
        />
      </li>
    </ul>
  )
}

export default TrackChangesMenu
