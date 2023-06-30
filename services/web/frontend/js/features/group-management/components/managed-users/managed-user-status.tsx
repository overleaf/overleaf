import { useTranslation } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'

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
              <i
                className="fa fa-clock-o"
                aria-hidden="true"
                aria-label={t('pending_invite')}
              />
              &nbsp;
              {t('managed')}
            </span>
          ) : (
            <>
              {user.enrollment?.managedBy ? (
                <span className="security-state-managed">
                  <i
                    className="fa fa-check"
                    aria-hidden="true"
                    aria-label={t('managed')}
                  />
                  &nbsp;
                  {t('managed')}
                </span>
              ) : (
                <span className="security-state-not-managed">
                  <i
                    className="fa fa-times"
                    aria-hidden="true"
                    aria-label={t('not_managed')}
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
