import { memo, useCallback, useState } from 'react'
import { useRangesActionsContext } from '../context/ranges-context'
import {
  Change,
  DeleteOperation,
  EditOperation,
} from '../../../../../types/change'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { FormatTimeBasedOnYear } from '@/shared/components/format-time-based-on-year'
import { useChangesUsersContext } from '../context/changes-users-context'
import { ReviewPanelChangeUser } from './review-panel-change-user'
import { ReviewPanelEntry } from './review-panel-entry'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { ExpandableContent } from './review-panel-expandable-content'
import { useUserContext } from '@/shared/context/user-context'

export const ReviewPanelChange = memo<{
  change: Change<EditOperation>
  aggregate?: Change<DeleteOperation>
  top?: number
  editable?: boolean
  docId: string
  hoverRanges?: boolean
  hovered?: boolean
  onEnter?: (changeId: string) => void
  onLeave?: (changeId: string) => void
}>(
  ({
    change,
    aggregate,
    top,
    docId,
    hoverRanges,
    editable = true,
    hovered,
    onEnter,
    onLeave,
  }) => {
    const { t } = useTranslation()
    const { acceptChanges, rejectChanges } = useRangesActionsContext()
    const permissions = usePermissionsContext()
    const changesUsers = useChangesUsersContext()
    const { showGenericMessageModal } = useModalsContext()
    const user = useUserContext()

    const [accepting, setAccepting] = useState(false)

    const acceptHandler = useCallback(async () => {
      setAccepting(true)
      try {
        if (aggregate) {
          await acceptChanges(change.id, aggregate.id)
        } else {
          await acceptChanges(change.id)
        }
      } catch (err) {
        showGenericMessageModal(
          t('accept_change_error_title'),
          t('accept_change_error_description')
        )
      } finally {
        setAccepting(false)
      }
    }, [acceptChanges, aggregate, change.id, showGenericMessageModal, t])

    if (!changesUsers) {
      // if users are not loaded yet, do not show "Unknown" user
      return null
    }

    const isChangeAuthor = change.metadata?.user_id === user.id

    return (
      <ReviewPanelEntry
        className={classnames('review-panel-entry-change', {
          'review-panel-entry-insert': 'i' in change.op,
          'review-panel-entry-delete': 'd' in change.op,
          'review-panel-entry-hover': hovered,
          // TODO: aggregate
        })}
        top={top}
        op={change.op}
        position={change.op.p}
        docId={docId}
        hoverRanges={hoverRanges}
        disabled={accepting}
        onEnterEntryIndicator={onEnter && (() => onEnter(change.id))}
        onLeaveEntryIndicator={onLeave && (() => onLeave(change.id))}
        entryIndicator="edit"
      >
        <div
          className="review-panel-entry-content"
          onMouseEnter={onEnter && (() => onEnter(change.id))}
          onMouseLeave={onLeave && (() => onLeave(change.id))}
        >
          <div className="review-panel-entry-header">
            <div>
              <ReviewPanelChangeUser change={change} />
              {change.metadata?.ts && (
                <div className="review-panel-entry-time">
                  <FormatTimeBasedOnYear date={change.metadata.ts} />
                </div>
              )}
            </div>
            {editable && (
              <div className="review-panel-entry-actions">
                {permissions.write && (
                  <OLTooltip
                    id="accept-change"
                    overlayProps={{ placement: 'bottom' }}
                    description={t('accept_change')}
                    tooltipProps={{ className: 'review-panel-tooltip' }}
                  >
                    <button
                      type="button"
                      className="btn"
                      onClick={acceptHandler}
                      tabIndex={0}
                    >
                      <MaterialIcon
                        type="check"
                        className="review-panel-entry-actions-icon"
                        accessibilityLabel={t('accept_change')}
                      />
                    </button>
                  </OLTooltip>
                )}

                {(permissions.write ||
                  (permissions.trackedWrite && isChangeAuthor)) && (
                  <OLTooltip
                    id="reject-change"
                    description={t('reject_change')}
                    overlayProps={{ placement: 'bottom' }}
                    tooltipProps={{ className: 'review-panel-tooltip' }}
                  >
                    <button
                      tabIndex={0}
                      type="button"
                      className="btn"
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
                    </button>
                  </OLTooltip>
                )}
              </div>
            )}
          </div>

          <div className="review-panel-change-body">
            {'i' in change.op && (
              <>
                {aggregate ? (
                  <MaterialIcon
                    className="review-panel-entry-icon review-panel-entry-change-icon review-panel-entry-icon-changed"
                    type="edit"
                  />
                ) : (
                  <MaterialIcon
                    className="review-panel-entry-icon review-panel-entry-change-icon review-panel-entry-icon-accept"
                    type="add_circle"
                  />
                )}

                {aggregate ? (
                  <span>
                    {t('aggregate_changed')}:{' '}
                    <del className="review-panel-content-highlight">
                      <ExpandableContent
                        inline
                        content={aggregate.op.d}
                        checkNewLines={false}
                      />
                    </del>{' '}
                    {t('aggregate_to')}{' '}
                    <ExpandableContent
                      inline
                      content={change.op.i}
                      checkNewLines={false}
                    />
                  </span>
                ) : (
                  <span>
                    {t('tracked_change_added')}:&nbsp;
                    <ins className="review-panel-content-highlight">
                      <ExpandableContent
                        content={change.op.i}
                        checkNewLines={false}
                      />
                    </ins>
                  </span>
                )}
              </>
            )}

            {'d' in change.op && (
              <>
                <MaterialIcon
                  className="review-panel-entry-icon review-panel-entry-change-icon review-panel-entry-icon-reject"
                  type="delete"
                />

                <span>
                  {t('tracked_change_deleted')}:&nbsp;
                  <del className="review-panel-content-highlight">
                    <ExpandableContent
                      content={change.op.d}
                      checkNewLines={false}
                    />
                  </del>
                </span>
              </>
            )}
          </div>
        </div>
      </ReviewPanelEntry>
    )
  }
)
ReviewPanelChange.displayName = 'ReviewPanelChange'
