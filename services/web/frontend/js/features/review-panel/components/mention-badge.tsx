import { useId, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { UserId } from '../../../../../types/user'
import { useChangesUsersContext } from '../context/changes-users-context'
import { buildName } from '../utils/build-name'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

export const MentionBadge: FC<{ userId: UserId }> = ({ userId }) => {
  const { t } = useTranslation()
  const id = useId()
  const changesUsers = useChangesUsersContext()
  const user = changesUsers?.get(userId)

  if (!user) {
    return <span className="review-panel-mention">@{t('unknown')}</span>
  }

  return (
    <OLTooltip
      id={`mention-${id}`}
      description={user.email}
      overlayProps={{ placement: 'bottom' }}
      tooltipProps={{ className: 'review-panel-tooltip' }}
    >
      <span className="review-panel-mention">@{buildName(user)}</span>
    </OLTooltip>
  )
}
