import { memo } from 'react'
import { buildName } from '../utils/build-name'
import { ReviewPanelUser } from '../../../../../types/review-panel/review-panel'
import { ChangesUser } from '../context/changes-users-context'
import { getBackgroundColorForUserId } from '@/shared/utils/colors'
import { useTranslation } from 'react-i18next'

const ReviewPanelEntryUser = ({
  user,
}: {
  user?: ReviewPanelUser | ChangesUser
}) => {
  const { t } = useTranslation()
  const userName = user ? buildName(user) : t('deleted_user')

  return (
    <div className="review-panel-entry-user" translate="no">
      <span
        className="review-panel-entry-user-color-badge"
        style={{
          backgroundColor: getBackgroundColorForUserId(user?.id),
        }}
      />
      {userName}
    </div>
  )
}

export default memo(ReviewPanelEntryUser)
