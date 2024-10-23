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
import { useEntryClick } from '@/features/source-editor/components/review-panel/hooks/use-entry-click'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
  const { handleLayoutChange, acceptChanges, rejectChanges } =
    useReviewPanelUpdaterFnsContext()
  const [isCollapsed, setIsCollapsed] = useState(true)
  const {
    hoverCoords,
    indicatorRef,
    endHover,
    handleIndicatorMouseEnter,
    handleIndicatorClick,
  } = useIndicatorHover()

  const contentToDisplay = isCollapsed
    ? content.substring(0, contentLimit)
    : content

  const needsCollapsing = content.length > contentLimit
  const isInsert = type === 'insert'

  const handleEntryClick = useEntryClick(docId, offset, endHover)

  const handleToggleCollapse = () => {
    setIsCollapsed(value => !value)
    handleLayoutChange()
  }

  return (
    <EntryContainer
      id={entryId}
      hoverCoords={hoverCoords}
      onClick={handleEntryClick}
      onMouseLeave={endHover}
    >
      <EntryCallout className={`rp-entry-callout-${type}`} />
      <EntryIndicator
        ref={indicatorRef}
        focused={focused}
        onMouseEnter={handleIndicatorMouseEnter}
        onClick={handleIndicatorClick}
      >
        {isInsert ? (
          <BootstrapVersionSwitcher
            bs3={<Icon type="pencil" />}
            bs5={<MaterialIcon type="edit" />}
          />
        ) : (
          <i className="rp-icon-delete" />
        )}
      </EntryIndicator>
      <div
        className={classnames('rp-entry', `rp-entry-${type}`, {
          'rp-entry-focused': focused,
        })}
      >
        <div className="rp-entry-body">
          <div className="rp-entry-action-icon">
            {isInsert ? (
              <BootstrapVersionSwitcher
                bs3={<Icon type="pencil" />}
                bs5={<MaterialIcon type="edit" />}
              />
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
                    className="rp-collapse-toggle"
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
              <span className="rp-entry-metadata-element">
                {formatTime(timestamp, 'MMM D, Y h:mm A')}
              </span>
              {user && (
                <span className="rp-entry-metadata-element">
                  &nbsp;&bull;&nbsp;
                  <span
                    className="rp-entry-user"
                    style={{ color: `hsl(${user.hue}, 70%, 40%)` }}
                  >
                    {user.name ?? t('anonymous')}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        {permissions.write && (
          <EntryActions>
            <EntryActions.Button onClick={() => rejectChanges(entryIds)}>
              <BootstrapVersionSwitcher
                bs3={<Icon type="times" />}
                bs5={<MaterialIcon type="close" />}
              />
              &nbsp;{t('reject')}
            </EntryActions.Button>
            <EntryActions.Button onClick={() => acceptChanges(entryIds)}>
              <BootstrapVersionSwitcher
                bs3={<Icon type="check" />}
                bs5={<MaterialIcon type="check" />}
              />
              &nbsp;{t('accept')}
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
