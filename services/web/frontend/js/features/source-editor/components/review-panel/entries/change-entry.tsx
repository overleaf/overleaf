import { useTranslation } from 'react-i18next'
import { memo, useState } from 'react'
import EntryContainer from './entry-container'
import EntryCallout from './entry-callout'
import EntryActions from './entry-actions'
import Icon from '../../../../../shared/components/icon'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import { formatTime } from '../../../../utils/format-date'
import classnames from 'classnames'
import { ReviewPanelChangeEntry } from '../../../../../../../types/review-panel/entry'
import { BaseChangeEntryProps } from '../types/base-change-entry-props'
import comparePropsWithShallowArrayCompare from '../utils/compare-props-with-shallow-array-compare'
import useIndicatorHover from '../hooks/use-indicator-hover'
import EntryIndicator from './entry-indicator'

interface ChangeEntryProps extends BaseChangeEntryProps {
  type: ReviewPanelChangeEntry['type']
}

function ChangeEntry({
  docId,
  entryId,
  permissions,
  user,
  content,
  offset,
  type,
  focused,
  entryIds,
  timestamp,
  contentLimit = 40,
}: ChangeEntryProps) {
  const { t } = useTranslation()
  const { handleLayoutChange, acceptChanges, rejectChanges, gotoEntry } =
    useReviewPanelUpdaterFnsContext()
  const [isCollapsed, setIsCollapsed] = useState(true)
  const {
    hoverCoords,
    indicatorRef,
    handleEntryMouseLeave,
    handleIndicatorMouseEnter,
    handleIndicatorClick,
  } = useIndicatorHover()

  const contentToDisplay = isCollapsed
    ? content.substring(0, contentLimit)
    : content

  const needsCollapsing = content.length > contentLimit
  const isInsert = type === 'insert'

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

  const handleToggleCollapse = () => {
    setIsCollapsed(value => !value)
    handleLayoutChange()
  }

  return (
    <EntryContainer
      id={entryId}
      hoverCoords={hoverCoords}
      onClick={handleEntryClick}
      onMouseLeave={handleEntryMouseLeave}
    >
      <EntryCallout className={`rp-entry-callout-${type}`} />
      <EntryIndicator
        ref={indicatorRef}
        focused={focused}
        onMouseEnter={handleIndicatorMouseEnter}
        onClick={handleIndicatorClick}
      >
        {isInsert ? <Icon type="pencil" /> : <i className="rp-icon-delete" />}
      </EntryIndicator>
      <div
        className={classnames('rp-entry', `rp-entry-${type}`, {
          'rp-entry-focused': focused,
        })}
      >
        <div className="rp-entry-body">
          <div className="rp-entry-action-icon">
            {isInsert ? (
              <Icon type="pencil" />
            ) : (
              <i className="rp-icon-delete" />
            )}
          </div>
          <div className="rp-entry-details">
            <div className="rp-entry-description">
              <span>
                {isInsert ? (
                  <>
                    {t('tracked_change_added')}&nbsp;
                    <ins className="rp-content-highlight">
                      {contentToDisplay}
                    </ins>
                  </>
                ) : (
                  <>
                    {t('tracked_change_deleted')}&nbsp;
                    <del className="rp-content-highlight">
                      {contentToDisplay}
                    </del>
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
  ChangeEntry,
  comparePropsWithShallowArrayCompare('entryIds')
)
