import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import EntryContainer from './entry-container'
import EntryCallout from './entry-callout'
import EntryActions from './entry-actions'
import Icon from '../../../../../shared/components/icon'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../../context/review-panel/review-panel-context'
import { formatTime } from '../../../../utils/format-date'
import classnames from 'classnames'
import {
  ReviewPanelDeleteEntry,
  ReviewPanelInsertEntry,
} from '../../../../../../../types/review-panel/entry'
import {
  ReviewPanelPermissions,
  ReviewPanelUser,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { DocId } from '../../../../../../../types/project-settings'

type ChangeEntryProps = {
  docId: DocId
  entry: ReviewPanelInsertEntry | ReviewPanelDeleteEntry
  entryId: ThreadId
  permissions: ReviewPanelPermissions
  user: ReviewPanelUser | undefined
  contentLimit?: number
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onIndicatorClick?: () => void
}

function ChangeEntry({
  docId,
  entry,
  entryId,
  permissions,
  user,
  contentLimit = 40,
  onMouseEnter,
  onMouseLeave,
  onIndicatorClick,
}: ChangeEntryProps) {
  const { t } = useTranslation()
  const { acceptChanges, rejectChanges, gotoEntry } =
    useReviewPanelValueContext()
  const { handleLayoutChange } = useReviewPanelUpdaterFnsContext()
  const [isCollapsed, setIsCollapsed] = useState(true)

  const content = isCollapsed
    ? entry.content.substring(0, contentLimit)
    : entry.content

  const needsCollapsing = entry.content.length > contentLimit

  const handleEntryClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element

    for (const selector of [
      '.rp-entry',
      '.rp-entry-description',
      '.rp-entry-body',
      '.rp-entry-action-icon i',
    ]) {
      if (target.matches(selector)) {
        gotoEntry(docId, entry.offset)
        break
      }
    }
  }

  const handleToggleCollapse = () => {
    setIsCollapsed(value => !value)
    handleLayoutChange()
  }

  return (
    <EntryContainer
      onClick={handleEntryClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      id={entryId}
    >
      <EntryCallout className={`rp-entry-callout-${entry.type}`} />
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={classnames('rp-entry-indicator', {
          'rp-entry-indicator-focused': entry.focused,
        })}
        onClick={onIndicatorClick}
      >
        {entry.type === 'insert' ? (
          <Icon type="pencil" />
        ) : (
          <i className="rp-icon-delete" />
        )}
      </div>
      <div
        className={classnames('rp-entry', `rp-entry-${entry.type}`, {
          'rp-entry-focused': entry.focused,
        })}
      >
        <div className="rp-entry-body">
          <div className="rp-entry-action-icon">
            {entry.type === 'insert' ? (
              <Icon type="pencil" />
            ) : (
              <i className="rp-icon-delete" />
            )}
          </div>
          <div className="rp-entry-details">
            <div className="rp-entry-description">
              <span>
                {entry.type === 'insert' ? (
                  <>
                    {t('tracked_change_added')}&nbsp;
                    <ins className="rp-content-highlight">{content}</ins>
                  </>
                ) : (
                  <>
                    {t('tracked_change_deleted')}&nbsp;
                    <del className="rp-content-highlight">{content}</del>
                  </>
                )}
                {needsCollapsing && (
                  <button
                    className="rp-collapse-toggle btn-inline-link"
                    onClick={handleToggleCollapse}
                  >
                    {isCollapsed
                      ? `… (${t('show_all')})`
                      : ` (${t('show_less')})`}
                  </button>
                )}
              </span>
            </div>
            <div className="rp-entry-metadata">
              {formatTime(entry.metadata.ts, 'MMM D, Y h:mm A')}
              &nbsp;&bull;&nbsp;
              {user && (
                <span
                  className="rp-entry-user"
                  style={{ color: `hsl(${user.hue}, 70%, 40%)` }}
                >
                  {user.name ?? t('anonymous')}
                </span>
              )}
            </div>
          </div>
        </div>
        {permissions.write && (
          <EntryActions>
            <EntryActions.Button onClick={() => rejectChanges(entry.entry_ids)}>
              <Icon type="times" /> {t('reject')}
            </EntryActions.Button>
            <EntryActions.Button onClick={() => acceptChanges(entry.entry_ids)}>
              <Icon type="check" /> {t('accept')}
            </EntryActions.Button>
          </EntryActions>
        )}
      </div>
    </EntryContainer>
  )
}

export default ChangeEntry
