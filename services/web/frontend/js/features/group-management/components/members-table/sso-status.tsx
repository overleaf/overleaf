import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import MaterialIcon from '@/shared/components/material-icon'

type SSOStatusProps = {
  user: User
}
export default function SSOStatus({ user }: SSOStatusProps) {
  const { t } = useTranslation()
  const invitedSSO = (
    <span className="security-state-invite-pending">
      <MaterialIcon
        type="schedule"
        category="outlined"
        accessibilityLabel={t('pending_invite')}
      />
      &nbsp; {t('sso')}
    </span>
  )
  const acceptedSSO = (
    <span className="security-state-managed">
      <MaterialIcon type="check" accessibilityLabel={t('sso_active')} />
      &nbsp; {t('sso')}
    </span>
  )
  const notAcceptedSSO = (
    <span className="security-state-not-managed">
      <MaterialIcon type="close" accessibilityLabel={t('sso_not_active')} />
      &nbsp; {t('sso')}
    </span>
  )

  if (user.invite) {
    return invitedSSO
  }

  return user.enrollment?.sso ? acceptedSSO : notAcceptedSSO
}
