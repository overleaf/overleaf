import { FC, memo } from 'react'
import { Button } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

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
      <Button
        bsSize="small"
        className="btn-secondary review-panel-more-comments-button"
        onClick={onClick}
      >
        <MaterialIcon type={`arrow_${direction}_alt`} />
        {t('more_comments')}
      </Button>
    </div>
  )
}

export default memo(MoreCommentsButton)
