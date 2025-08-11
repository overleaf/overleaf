import { FC, memo } from 'react'
import classnames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import {
  useReviewPanelViewActionsContext,
  useReviewPanelViewContext,
} from '../context/review-panel-view-context'

const ReviewPanelTabs: FC = () => {
  const subView = useReviewPanelViewContext()
  const { setView: setSubView } = useReviewPanelViewActionsContext()

  const { t } = useTranslation()

  return (
    <>
      <button
        role="tab"
        aria-selected={subView === 'cur_file'}
        aria-controls="review-panel-current-file"
        id="review-panel-tab-button-current-file"
        className={classnames('review-panel-tab', {
          'review-panel-tab-active': subView === 'cur_file',
        })}
        onClick={() => setSubView('cur_file')}
      >
        <MaterialIcon type="description" />
        {t('current_file')}
      </button>
      <button
        role="tab"
        aria-selected={subView === 'overview'}
        aria-controls="review-panel-overview"
        id="review-panel-tab-button-overview"
        className={classnames('review-panel-tab', {
          'review-panel-tab-active': subView === 'overview',
        })}
        onClick={() => setSubView('overview')}
      >
        <MaterialIcon type="list" />
        {t('overview')}
      </button>
    </>
  )
}

export default memo(ReviewPanelTabs)
