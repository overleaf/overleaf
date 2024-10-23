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
import useIndicatorHover from '../hooks/use-indicator-hover'
import EntryIndicator from './entry-indicator'
import { useEntryClick } from '@/features/source-editor/components/review-panel/hooks/use-entry-click'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

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
}: AggregateChangeEntryProps) {
  const { t } = useTranslation()
  const { acceptChanges, rejectChanges, handleLayoutChange } =
    useReviewPanelUpdaterFnsContext()
  const [isDeletionCollapsed, setIsDeletionCollapsed] = useState(true)
  const [isInsertionCollapsed, setIsInsertionCollapsed] = useState(true)
  const {
    hoverCoords,
    indicatorRef,
    endHover,
    handleIndicatorMouseEnter,
    handleIndicatorClick,
  } = useIndicatorHover()

  const deletionNeedsCollapsing = replacedContent.length > contentLimit
  const insertionNeedsCollapsing = content.length > contentLimit

  const deletionContent = isDeletionCollapsed
    ? replacedContent.substring(0, contentLimit)
    : replacedContent

  const insertionContent = isInsertionCollapsed
    ? content.substring(0, contentLimit)
    : content

  const handleEntryClick = useEntryClick(docId, offset, endHover)

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
      hoverCoords={hoverCoords}
      onClick={handleEntryClick}
      onMouseLeave={endHover}
    >
      <EntryCallout className="rp-entry-callout-aggregate" />
      <EntryIndicator
        ref={indicatorRef}
        focused={focused}
        onMouseEnter={handleIndicatorMouseEnter}
        onClick={handleIndicatorClick}
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="pencil" />}
          bs5={<MaterialIcon type="edit" />}
        />
      </EntryIndicator>
      <div
        className={classnames('rp-entry', 'rp-entry-aggregate', {
          'rp-entry-focused': focused,
        })}
      >
        <div className="rp-entry-body">
          <div className="rp-entry-action-icon">
            <BootstrapVersionSwitcher
              bs3={<Icon type="pencil" />}
              bs5={<MaterialIcon type="edit" />}
            />
          </div>
          <div className="rp-entry-details">
            <div className="rp-entry-description">
              {t('aggregate_changed')}&nbsp;
              <del className="rp-content-highlight">{deletionContent}</del>
              {deletionNeedsCollapsing && (
                <button
                  className="rp-collapse-toggle"
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
                  className="rp-collapse-toggle"
                  onClick={handleInsertionToggleCollapse}
                >
                  {isInsertionCollapsed
                    ? `… (${t('show_all')})`
                    : ` (${t('show_less')})`}
                </button>
              )}
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
  AggregateChangeEntry,
  comparePropsWithShallowArrayCompare('entryIds')
)
