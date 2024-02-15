import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import { User } from '../../../../../../types/group-management/user'
import MaterialIcon from '@/shared/components/material-icon'

type SSOStatusProps = {
  user: User
}

export default function SSOStatus({ user }: SSOStatusProps) {
  const groupId = getMeta('ol-groupId')

  if (user.invite) {
    return <PendingInvite />
  }

  const linkedSSO = user.enrollment?.sso?.some(sso => sso.groupId === groupId)

  return linkedSSO ? <SSOLinked /> : <SSOUnlinked />
}

function PendingInvite() {
  const { t } = useTranslation()
  return (
    <span className="security-state-invite-pending">
      <MaterialIcon type="schedule" accessibilityLabel={t('pending_invite')} />
      &nbsp; {t('sso')}
    </span>
  )
}

function SSOLinked() {
  const { t } = useTranslation()
  return (
    <span className="security-state-managed">
      <MaterialIcon type="check" accessibilityLabel={t('sso_active')} />
      &nbsp; {t('sso')}
    </span>
  )
}

function SSOUnlinked() {
  const { t } = useTranslation()
  return (
    <span className="security-state-not-managed">
      <MaterialIcon type="close" accessibilityLabel={t('sso_not_active')} />
      &nbsp; {t('sso')}
    </span>
  )
}
