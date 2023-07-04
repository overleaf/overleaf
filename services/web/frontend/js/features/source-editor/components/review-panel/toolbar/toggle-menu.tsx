import { useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import Tooltip from '../../../../../shared/components/tooltip'
import Icon from '../../../../../shared/components/icon'
import TrackChangesToggle from './track-changes-toggle'
import { useProjectContext } from '../../../../../shared/context/project-context'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../../context/review-panel/review-panel-context'
import classnames from 'classnames'
import useCollapseHeight from '../hooks/use-collapse-height'

function ToggleMenu() {
  const { t } = useTranslation()
  const project = useProjectContext()
  const { setShouldCollapse } = useReviewPanelUpdaterFnsContext()
  const {
    permissions,
    wantTrackChanges,
    shouldCollapse,
    toggleTrackChangesForEveryone,
    toggleTrackChangesForUser,
    toggleTrackChangesForGuests,
    trackChangesState,
    trackChangesOnForEveryone,
    trackChangesOnForGuests,
    trackChangesForGuestsAvailable,
    formattedProjectMembers,
  } = useReviewPanelValueContext()

  const containerRef = useRef<HTMLUListElement | null>(null)
  useCollapseHeight(containerRef, shouldCollapse)

  return (
    <>
      <span className="review-panel-toolbar-label">
        {wantTrackChanges && (
          <span className="review-panel-toolbar-icon-on">
            <Icon type="circle" />
          </span>
        )}

        <button
          className="review-panel-toolbar-collapse-button"
          onClick={() => setShouldCollapse(value => !value)}
        >
          {wantTrackChanges ? (
            // eslint-disable-next-line react/jsx-key
            <Trans i18nKey="track_changes_is_on" components={[<strong />]} />
          ) : (
            // eslint-disable-next-line react/jsx-key
            <Trans i18nKey="track_changes_is_off" components={[<strong />]} />
          )}
          <span
            className={classnames('rp-tc-state-collapse', {
              'rp-tc-state-collapse-on': shouldCollapse,
            })}
          >
            <Icon type="angle-down" />
          </span>
        </button>
      </span>

      <ul
        className="rp-tc-state"
        ref={containerRef}
        data-testid="review-panel-track-changes-menu"
      >
        <li className="rp-tc-state-item rp-tc-state-item-everyone">
          <Tooltip
            description={t('tc_switch_everyone_tip')}
            id="track-changes-switch-everyone"
            overlayProps={{
              container: document.body,
              placement: 'left',
              delay: 1000,
            }}
          >
            <span className="rp-tc-state-item-name">{t('tc_everyone')}</span>
          </Tooltip>

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
            <Tooltip
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
            </Tooltip>

            <TrackChangesToggle
              id={`track-changes-user-toggle-${member.id}`}
              description={t('track_changes_for_x', { name: member.name })}
              handleToggle={() =>
                toggleTrackChangesForUser(
                  !trackChangesState[member.id].value,
                  member.id
                )
              }
              value={trackChangesState[member.id].value}
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
          <Tooltip
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
          </Tooltip>

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
    </>
  )
}

export default ToggleMenu
