import { useTranslation } from 'react-i18next'
import { memo, useState } from 'react'
import EntryContainer from './entry-container'
import EntryCallout from './entry-callout'
import EntryActions from './entry-actions'
import Icon from '../../../../../shared/components/icon'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import { formatTime } from '../../../../utils/format-date'
import classnames from 'classnames'
import comparePropsWithShallowArrayCompare from '../utils/compare-props-with-shallow-array-compare'
import { BaseChangeEntryProps } from '../types/base-change-entry-props'

interface AggregateChangeEntryProps extends BaseChangeEntryProps {
  replacedContent: string
}

function AggregateChangeEntry({
  docId,
  entryId,
  permissions,
  user,
  content,
  replacedContent,
  offset,
  focused,
  entryIds,
  timestamp,
  contentLimit = 17,
  onMouseEnter,
  onMouseLeave,
  onIndicatorClick,
}: AggregateChangeEntryProps) {
  const { t } = useTranslation()
  const { acceptChanges, rejectChanges, gotoEntry, handleLayoutChange } =
    useReviewPanelUpdaterFnsContext()
  const [isDeletionCollapsed, setIsDeletionCollapsed] = useState(true)
  const [isInsertionCollapsed, setIsInsertionCollapsed] = useState(true)

  const deletionNeedsCollapsing = replacedContent.length > contentLimit
  const insertionNeedsCollapsing = content.length > contentLimit

  const deletionContent = isDeletionCollapsed
    ? replacedContent.substring(0, contentLimit)
    : replacedContent

  const insertionContent = isInsertionCollapsed
    ? content.substring(0, contentLimit)
    : content

  const handleEntryClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element

    for (const selector of [
      '.rp-entry',
      '.rp-entry-description',
      '.rp-entry-body',
      '.rp-entry-action-icon i',
    ]) {
      if (target.matches(selector)) {
        gotoEntry(docId, offset)
        break
      }
    }
  }

  const handleDeletionToggleCollapse = () => {
    setIsDeletionCollapsed(value => !value)
    handleLayoutChange()
  }

  const handleInsertionToggleCollapse = () => {
    setIsInsertionCollapsed(value => !value)
    handleLayoutChange()
  }

  return (
    <EntryContainer
      id={entryId}
      onClick={handleEntryClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <EntryCallout className="rp-entry-callout-aggregate" />
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
      <div
        className={classnames('rp-entry-indicator', {
          'rp-entry-indicator-focused': focused,
        })}
        onClick={onIndicatorClick}
      >
        <Icon type="pencil" />
      </div>
      <div
        className={classnames('rp-entry', 'rp-entry-aggregate', {
          'rp-entry-focused': focused,
        })}
      >
        <div className="rp-entry-body">
          <div className="rp-entry-action-icon">
            <Icon type="pencil" />
          </div>
          <div className="rp-entry-details">
            <div className="rp-entry-description">
              {t('aggregate_changed')}&nbsp;
              <del className="rp-content-highlight">{deletionContent}</del>
              {deletionNeedsCollapsing && (
                <button
                  className="rp-collapse-toggle btn-inline-link"
                  onClick={handleDeletionToggleCollapse}
                >
                  {isDeletionCollapsed
                    ? `… (${t('show_all')})`
                    : ` (${t('show_less')})`}
                </button>
              )}{' '}
              {t('aggregate_to')}&nbsp;
              <ins className="rp-content-highlight">{insertionContent}</ins>
              {insertionNeedsCollapsing && (
                <button
                  className="rp-collapse-toggle btn-inline-link"
                  onClick={handleInsertionToggleCollapse}
                >
                  {isInsertionCollapsed
                    ? `… (${t('show_all')})`
                    : ` (${t('show_less')})`}
                </button>
              )}
            </div>
            <div className="rp-entry-metadata">
              {formatTime(timestamp, 'MMM D, Y h:mm A')}
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
            <EntryActions.Button onClick={() => rejectChanges(entryIds)}>
              <Icon type="times" /> {t('reject')}
            </EntryActions.Button>
            <EntryActions.Button onClick={() => acceptChanges(entryIds)}>
              <Icon type="check" /> {t('accept')}
            </EntryActions.Button>
          </EntryActions>
        )}
      </div>
    </EntryContainer>
  )
}

export default memo(
  AggregateChangeEntry,
  comparePropsWithShallowArrayCompare('entryIds')
)
