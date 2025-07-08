import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import MaterialIcon from '@/shared/components/material-icon'

type ManagedUserStatusProps = {
  user: User
}
export default function ManagedUserStatus({ user }: ManagedUserStatusProps) {
  const { t } = useTranslation()
  const managedUserInvite = (
    <span className="security-state-invite-pending">
      <MaterialIcon type="schedule" accessibilityLabel={t('pending_invite')} />
      &nbsp;
      {t('managed')}
    </span>
  )

  const managedUserAccepted = (
    <span className="security-state-managed">
      <MaterialIcon type="check" accessibilityLabel={t('managed')} />
      &nbsp;
      {t('managed')}
    </span>
  )
  const managedUserNotAccepted = (
    <span className="security-state-not-managed">
      <MaterialIcon type="close" accessibilityLabel={t('not_managed')} />
      &nbsp;
      {t('managed')}
    </span>
  )

  if (user.invite) {
    return managedUserInvite
  }
  return user.enrollment?.managedBy
    ? managedUserAccepted
    : managedUserNotAccepted
}
