import { Dispatch, FC, memo, SetStateAction } from 'react'
import classnames from 'classnames'
import { SubView } from '../components/review-panel'

const ReviewPanelTabs: FC<{
  subView: SubView
  setSubView: Dispatch<SetStateAction<SubView>>
}> = ({ subView, setSubView }) => {
  return (
    <>
      <button
        className={classnames('rp-nav-item', {
          'rp-nav-item-active': subView === 'cur_file',
        })}
        onClick={() => setSubView('cur_file')}
      >
        Current file
      </button>
      <button
        className={classnames('rp-nav-item', {
          'rp-nav-item-active': subView === 'overview',
        })}
        onClick={() => setSubView('overview')}
      >
        Overview
      </button>
    </>
  )
}

export default memo(ReviewPanelTabs)
