import { memo, useCallback, useMemo, useState } from 'react'
import { useRangesActionsContext } from '../context/ranges-context'
import {
  Change,
  DeleteOperation,
  EditOperation,
} from '../../../../../types/change'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { FormatTimeBasedOnYear } from '@/shared/components/format-time-based-on-year'
import { useChangesUsersContext } from '../context/changes-users-context'
import { ReviewPanelChangeUser } from './review-panel-change-user'
import { ReviewPanelEntry } from './review-panel-entry'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { ExpandableContent } from './review-panel-expandable-content'
import { useUserContext } from '@/shared/context/user-context'
import { ChangeAction } from '@/features/review-panel/components/review-panel-change-action'
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
} from '@/features/review-panel/components/review-panel-action-icons'

export const ReviewPanelChange = memo<{
  change: Change<EditOperation>
  aggregate?: Change<DeleteOperation>
  top?: number
  editable?: boolean
  docId: string
  hoverRanges?: boolean
  hovered?: boolean
  handleEnter?: (changeId: string) => void
  handleLeave?: () => void
}>(
  ({
    change,
    aggregate,
    top,
    docId,
    hoverRanges,
    editable = true,
    hovered,
    handleEnter,
    handleLeave,
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
          await acceptChanges(change, aggregate)
        } else {
          await acceptChanges(change)
        }
      } catch (err) {
        showGenericMessageModal(
          t('accept_change_error_title'),
          t('accept_change_error_description')
        )
      } finally {
        setAccepting(false)
      }
    }, [acceptChanges, aggregate, change, showGenericMessageModal, t])

    const rejectHandler = useCallback(async () => {
      if (aggregate) {
        await rejectChanges(change, aggregate)
      } else {
        await rejectChanges(change)
      }
    }, [aggregate, change, rejectChanges])

    const translations = useMemo(
      () => ({
        accept_change: t('accept_change'),
        reject_change: t('reject_change'),
        aggregate_changed: t('aggregate_changed'),
        aggregate_to: t('aggregate_to'),
        tracked_change_added: t('tracked_change_added'),
        tracked_change_deleted: t('tracked_change_deleted'),
      }),
      [t]
    )

    const { handleMouseEnter, handleMouseLeave } = useMemo(
      () => ({
        handleMouseEnter: handleEnter && (() => handleEnter(change.id)),
        handleMouseLeave: handleLeave && (() => handleLeave()),
      }),
      [change.id, handleEnter, handleLeave]
    )

    if (!changesUsers) {
      // if users are not loaded yet, do not show "Unknown" user
      return null
    }

    const isChangeAuthor = change.metadata?.user_id === user.id
    const aggregateChange = aggregate && /\S/.test(aggregate.op.d)

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
        handleEnter={handleMouseEnter}
        handleLeave={handleMouseLeave}
        entryIndicator="edit"
      >
        <div
          className="review-panel-entry-content"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
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
                  <ChangeAction
                    id="accept-change"
                    label={translations.accept_change}
                    type="check"
                    handleClick={acceptHandler}
                  />
                )}

                {(permissions.write ||
                  (permissions.trackedWrite && isChangeAuthor)) && (
                  <ChangeAction
                    id="reject-change"
                    label={translations.reject_change}
                    type="close"
                    handleClick={rejectHandler}
                  />
                )}
              </div>
            )}
          </div>

          <div className="review-panel-change-body">
            {'i' in change.op && (
              <>
                {aggregateChange ? <EditIcon /> : <AddIcon />}

                {aggregateChange ? (
                  <span>
                    {translations.aggregate_changed}:{' '}
                    <del className="review-panel-content-highlight">
                      <ExpandableContent
                        inline
                        content={aggregate.op.d}
                        checkNewLines={false}
                      />
                    </del>{' '}
                    {translations.aggregate_to}{' '}
                    <ExpandableContent
                      inline
                      content={change.op.i}
                      checkNewLines={false}
                    />
                  </span>
                ) : (
                  <span>
                    {translations.tracked_change_added}:&nbsp;
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
                <DeleteIcon />
                <span>
                  {translations.tracked_change_deleted}:&nbsp;
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
