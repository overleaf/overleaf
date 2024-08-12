import { memo } from 'react'
import { useRangesActionsContext } from '../context/ranges-context'
import {
  Change,
  DeleteOperation,
  EditOperation,
} from '../../../../../types/change'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import { useCodeMirrorStateContext } from '@/features/source-editor/components/codemirror-editor'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { isFocused } from '../utils/is-focused'
import { Button } from 'react-bootstrap'
import Tooltip from '@/shared/components/tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { formatTimeBasedOnYear } from '@/features/utils/format-date'
import { useChangesUsersContext } from '../context/changes-users-context'
import { ReviewPanelChangeUser } from './review-panel-change-user'

export const ReviewPanelChange = memo<{
  change: Change<EditOperation>
  aggregate?: Change<DeleteOperation>
  top?: number
}>(({ change, aggregate, top }) => {
  const state = useCodeMirrorStateContext()
  const { t } = useTranslation()
  const { acceptChanges, rejectChanges } = useRangesActionsContext()
  const permissions = usePermissionsContext()
  const changesUsers = useChangesUsersContext()

  if (!changesUsers) {
    // if users are not loaded yet, do not show "Unknown" user
    return null
  }

  const focused = isFocused(change.op, state.selection.main)

  return (
    <div
      className={classnames('review-panel-entry', 'review-panel-entry-change', {
        'review-panel-entry-focused': focused,
        'review-panel-entry-insert': 'i' in change.op,
        'review-panel-entry-delete': 'd' in change.op,
        // TODO: aggregate
      })}
      data-top={top}
      data-pos={change.op.p}
      style={{
        position: top === undefined ? 'relative' : 'absolute',
        visibility: top === undefined ? 'visible' : 'hidden',
        transition: 'top .3s, left .1s, right .1s',
      }}
    >
      <div className="review-panel-entry-indicator">
        <MaterialIcon type="edit" className="review-panel-entry-icon" />
      </div>

      <div className="review-panel-entry-content">
        <div className="review-panel-entry-header">
          <div>
            <div className="review-panel-entry-user">
              <ReviewPanelChangeUser change={change} />
            </div>
            <div className="review-panel-entry-time">
              {formatTimeBasedOnYear(change.metadata?.ts)}
            </div>
          </div>
          {permissions.write && (
            <div className="review-panel-entry-actions">
              <Tooltip
                id="accept-change"
                overlayProps={{ placement: 'bottom' }}
                description={t('accept_change')}
              >
                <Button
                  onClick={() =>
                    aggregate
                      ? acceptChanges(change.id, aggregate.id)
                      : acceptChanges(change.id)
                  }
                  bsStyle={null}
                >
                  <MaterialIcon
                    type="check"
                    className="review-panel-entry-actions-icon"
                    accessibilityLabel={t('accept_change')}
                  />
                </Button>
              </Tooltip>

              <Tooltip
                id="reject-change"
                description={t('reject_change')}
                overlayProps={{ placement: 'bottom' }}
              >
                <Button
                  bsStyle={null}
                  onClick={() =>
                    aggregate
                      ? rejectChanges(change.id, aggregate.id)
                      : rejectChanges(change.id)
                  }
                >
                  <MaterialIcon
                    className="review-panel-entry-actions-icon"
                    accessibilityLabel={t('reject_change')}
                    type="close"
                  />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="review-panel-change-body">
          {'i' in change.op && (
            <>
              {aggregate ? (
                <MaterialIcon
                  className="review-panel-entry-icon review-panel-entry-icon-changed"
                  type="edit"
                />
              ) : (
                <MaterialIcon
                  className="review-panel-entry-icon review-panel-entry-icon-accept"
                  type="add_circle"
                />
              )}

              {aggregate ? (
                <span>
                  {t('aggregate_changed')}:{' '}
                  <del className="review-panel-content-highlight">
                    {aggregate.op.d}
                  </del>{' '}
                  {t('aggregate_to')}{' '}
                  <ins className="review-panel-content-highlight">
                    {change.op.i}
                  </ins>
                </span>
              ) : (
                <span>
                  {t('tracked_change_added')}:&nbsp;
                  <ins className="review-panel-content-highlight">
                    {change.op.i}
                  </ins>
                </span>
              )}
            </>
          )}

          {'d' in change.op && (
            <>
              <MaterialIcon
                className="review-panel-entry-icon review-panel-entry-icon-reject"
                type="delete"
              />

              <span>
                {t('tracked_change_deleted')}:&nbsp;
                <del className="review-panel-content-highlight">
                  {change.op.d}
                </del>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
})
ReviewPanelChange.displayName = 'ReviewPanelChange'
