import { Dispatch, FC, memo, SetStateAction } from 'react'
import classnames from 'classnames'
import { SubView } from '../components/review-panel'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'

const ReviewPanelTabs: FC<{
  subView: SubView
  setSubView: Dispatch<SetStateAction<SubView>>
}> = ({ subView, setSubView }) => {
  const { t } = useTranslation()

  return (
    <>
      <button
        className={classnames('review-panel-tab', {
          'review-panel-tab-active': subView === 'cur_file',
        })}
        onClick={() => setSubView('cur_file')}
      >
        <MaterialIcon type="description" />
        {t('current_file')}
      </button>
      <button
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
