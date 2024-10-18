import { FC, memo } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import OLButton from '@/features/ui/components/ol/ol-button'
import { bsVersion } from '@/features/utils/bootstrap-5'

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
      <OLButton
        variant="secondary"
        size="sm"
        className={bsVersion({ bs3: 'review-panel-more-comments-button' })}
        onClick={onClick}
        bs3Props={{
          bsSize: 'xsmall',
        }}
      >
        <MaterialIcon type={`arrow_${direction}_alt`} />
        {t('more_comments')}
      </OLButton>
    </div>
  )
}

export default memo(MoreCommentsButton)
