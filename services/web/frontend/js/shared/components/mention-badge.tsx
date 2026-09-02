import { useId, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { UserId } from '@ol-types/user'
import { useChangesUsersContext } from '@/shared/context/changes-users-context'
import { buildName } from '@/shared/utils/build-name'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

export const MentionBadge: FC<{ userId: UserId }> = ({ userId }) => {
  const { t } = useTranslation()
  const id = useId()
  const changesUsers = useChangesUsersContext()
  const user = changesUsers?.get(userId)

  if (!user) {
    return <span className="mention-badge">@{t('unknown')}</span>
  }

  return (
    <OLTooltip
      id={`mention-${id}`}
      description={user.email}
      overlayProps={{ placement: 'bottom' }}
      tooltipProps={{ className: 'review-panel-tooltip' }}
    >
      <span className="mention-badge">@{buildName(user)}</span>
    </OLTooltip>
  )
}
