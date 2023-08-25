import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import MaterialIcon from '../../../../shared/components/material-icon'

type ManagedUserStatusProps = {
  user: User
}
export default function ManagedUserStatus({ user }: ManagedUserStatusProps) {
  const { t } = useTranslation()
  return (
    <span>
      {user.isEntityAdmin ? (
        <>
          <span className="security-state-group-admin" />
        </>
      ) : (
        <>
          {user.invite ? (
            <span className="security-state-invite-pending">
              <MaterialIcon
                type="schedule"
                category="outlined"
                accessibilityLabel={t('pending_invite')}
              />
              &nbsp;
              {t('managed')}
            </span>
          ) : (
            <>
              {user.enrollment?.managedBy ? (
                <span className="security-state-managed">
                  <MaterialIcon
                    type="check"
                    accessibilityLabel={t('managed')}
                  />
                  &nbsp;
                  {t('managed')}
                </span>
              ) : (
                <span className="security-state-not-managed">
                  <MaterialIcon
                    type="close"
                    accessibilityLabel={t('not_managed')}
                  />
                  &nbsp;
                  {t('managed')}
                </span>
              )}
            </>
          )}
        </>
      )}
    </span>
  )
}
