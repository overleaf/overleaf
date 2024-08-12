import { FC, memo, useState } from 'react'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-editor'
import ReviewPanelTabs from './review-panel-tabs'
import ReviewPanelHeader from './review-panel-header'
import ReviewPanelCurrentFile from './review-panel-current-file'
import { ReviewPanelOverview } from './review-panel-overview'
import classnames from 'classnames'

export type SubView = 'cur_file' | 'overview'

export const PANEL_WIDTH = 230
export const PANEL_MINI_WIDTH = 20

const ReviewPanel: FC<{ mini: boolean }> = ({ mini }) => {
  const view = useCodeMirrorViewContext()
  // eslint-disable-next-line no-unused-vars
  const _state = useCodeMirrorStateContext() // needs to update on editor state changes

  const [subView, setSubView] = useState<SubView>('cur_file')

  const contentRect = view.contentDOM.getBoundingClientRect()
  const scrollRect = view.scrollDOM.getBoundingClientRect()

  return (
    <div
      className="review-panel-container"
      style={{
        overflowY: subView === 'overview' ? 'hidden' : undefined,
        position: subView === 'overview' ? 'sticky' : 'relative',
        top: subView === 'overview' ? 0 : undefined,
      }}
    >
      <div
        className={classnames('review-panel-new', {
          'review-panel-mini': mini,
        })}
        style={{
          flexShrink: 0,
          minHeight: subView === 'cur_file' ? contentRect.height : 'auto',
          height: subView === 'overview' ? '100%' : undefined,
          overflow: subView === 'overview' ? 'hidden' : undefined,
          width: mini ? PANEL_MINI_WIDTH : PANEL_WIDTH,
        }}
      >
        {!mini && (
          <ReviewPanelHeader top={scrollRect.top - 40} width={PANEL_WIDTH} />
        )}

        {subView === 'cur_file' && <ReviewPanelCurrentFile />}
        {subView === 'overview' && <ReviewPanelOverview />}

        <div
          className="review-panel-footer"
          style={{
            position: 'fixed',
            top: scrollRect.bottom - 66,
            zIndex: 1,
            background: '#fafafa',
            borderTop: 'solid 1px #d9d9d9',
            width: PANEL_WIDTH,
            display: mini ? 'none' : 'flex',
          }}
        >
          <ReviewPanelTabs subView={subView} setSubView={setSubView} />
        </div>
      </div>
    </div>
  )
}

export default memo(ReviewPanel)
