import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import MaterialIcon from '@/shared/components/material-icon'

type SSOStatusProps = {
  user: User
}
export default function SSOStatus({ user }: SSOStatusProps) {
  const { t } = useTranslation()
  return (
    <span>
      {user.invite ? (
        <span className="security-state-invite-pending">
          <MaterialIcon
            type="schedule"
            category="outlined"
            accessibilityLabel={t('pending_invite')}
          />
          &nbsp; {t('sso')}
        </span>
      ) : (
        <>
          {user.enrollment?.sso ? (
            <span className="security-state-managed">
              <MaterialIcon type="check" accessibilityLabel={t('sso_linked')} />
              &nbsp; {t('sso')}
            </span>
          ) : (
            <span className="security-state-not-managed">
              <MaterialIcon
                type="close"
                accessibilityLabel={t('sso_unlinked')}
              />
              &nbsp; {t('sso')}
            </span>
          )}
        </>
      )}
    </span>
  )
}
