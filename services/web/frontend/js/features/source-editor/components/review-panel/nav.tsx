import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import Icon from '../../../../shared/components/icon'
import {
  useReviewPanelValueContext,
  useReviewPanelUpdaterFnsContext,
} from '../../context/review-panel/review-panel-context'
import { isCurrentFileView, isOverviewView } from '../../utils/sub-view'
import { useCallback } from 'react'
import { useResizeObserver } from '../../../../shared/hooks/use-resize-observer'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function Nav() {
  const { t } = useTranslation()
  const { subView } = useReviewPanelValueContext()
  const { handleSetSubview, setNavHeight } = useReviewPanelUpdaterFnsContext()
  const handleResize = useCallback(
    el => {
      // Use requestAnimationFrame to prevent errors like "ResizeObserver loop
      // completed with undelivered notifications" that occur if onResize does
      // something complicated. The cost of this is that onResize lags one frame
      // behind, but it's unlikely to matter.
      const height = el.offsetHeight
      window.requestAnimationFrame(() => setNavHeight(height))
    },
    [setNavHeight]
  )
  const { elementRef } = useResizeObserver(handleResize)

  return (
    <div ref={elementRef} className="rp-nav" role="tablist">
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
        <BootstrapVersionSwitcher
          bs3={<Icon type="file-text-o" />}
          bs5={<MaterialIcon type="description" className="align-middle" />}
        />
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
        <BootstrapVersionSwitcher
          bs3={<Icon type="list" />}
          bs5={<MaterialIcon type="list" className="align-middle" />}
        />
        <span className="rp-nav-label">{t('overview')}</span>
      </button>
    </div>
  )
}

export default Nav
