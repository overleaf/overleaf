import { FC, memo } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'

const MoreCommentsButton: FC<{
  onClick: () => void
  direction: 'upward' | 'downward'
}> = ({ onClick, direction }) => {
  const { t } = useTranslation()

  return (
    <div
      className={classNames('review-panel-more-comments-button-container', {
        downwards: direction === 'downward',
        upwards: direction === 'upward',
      })}
    >
      <OLButton variant="secondary" size="sm" onClick={onClick}>
        <MaterialIcon type={`arrow_${direction}_alt`} />
        {t('more_comments')}
      </OLButton>
    </div>
  )
}

export default memo(MoreCommentsButton)
