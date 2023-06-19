import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import Icon from '../../../../shared/components/icon'
import {
  useReviewPanelValueContext,
  useReviewPanelUpdaterFnsContext,
} from '../../context/review-panel/review-panel-context'
import { isCurrentFileView, isOverviewView } from '../../utils/sub-view'

function Nav() {
  const { t } = useTranslation()
  const { subView } = useReviewPanelValueContext()
  const { handleSetSubview } = useReviewPanelUpdaterFnsContext()

  return (
    <div className="rp-nav" role="tablist">
      <button
        type="button"
        id="review-panel-tab-current-file"
        role="tab"
        aria-selected={isCurrentFileView(subView)}
        aria-controls="review-panel-current-file"
        tabIndex={isCurrentFileView(subView) ? 0 : -1}
        className={classnames('rp-nav-item', {
          'rp-nav-item-active': isCurrentFileView(subView),
        })}
        onClick={() => handleSetSubview('cur_file')}
      >
        <Icon type="file-text-o" />
        <span className="rp-nav-label">{t('current_file')}</span>
      </button>
      <button
        type="button"
        id="review-panel-tab-overview"
        role="tab"
        aria-selected={isOverviewView(subView)}
        aria-controls="review-panel-overview"
        tabIndex={isOverviewView(subView) ? 0 : -1}
        className={classnames('rp-nav-item', {
          'rp-nav-item-active': isOverviewView(subView),
        })}
        onClick={() => handleSetSubview('overview')}
      >
        <Icon type="list" />
        <span className="rp-nav-label">{t('overview')}</span>
      </button>
    </div>
  )
}

export default Nav
