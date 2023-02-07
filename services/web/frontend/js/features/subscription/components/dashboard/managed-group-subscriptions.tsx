import { Trans, useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'

export default function ManagedGroupSubscriptions() {
  const { t } = useTranslation()
  const { managedGroupSubscriptions } = useSubscriptionDashboardContext()

  if (!managedGroupSubscriptions) {
    return null
  }

  return (
    <>
      {managedGroupSubscriptions.map(subscription => (
        <div key={`managed-group-${subscription._id}`}>
          <p>
            {subscription.userIsGroupMember ? (
              <Trans
                i18nKey="you_are_a_manager_and_member_of_x_plan_as_member_of_group_subscription_y_administered_by_z"
                components={[<a href="/user/subscription/plans" />, <strong />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
                values={{
                  planName: subscription.planLevelName,
                  groupName: subscription.teamName || '',
                  adminEmail: subscription.admin_id.email,
                }}
              />
            ) : (
              <Trans
                i18nKey="you_are_a_manager_of_x_plan_as_member_of_group_subscription_y_administered_by_z"
                components={[<a href="/user/subscription/plans" />, <strong />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
                values={{
                  planName: subscription.planLevelName,
                  groupName: subscription.teamName || '',
                  adminEmail: subscription.admin_id.email,
                }}
              />
            )}
          </p>
          <p>
            <a
              className="btn btn-primary"
              href={`/manage/groups/${subscription._id}/members`}
            >
              <i className="fa fa-fw fa-users" /> {t('manage_members')}
            </a>
          </p>
          <p>
            <a href={`/manage/groups/${subscription._id}/managers`}>
              <i className="fa fa-fw fa-users" /> {t('manage_group_managers')}
            </a>
          </p>
          <p>
            <a href={`/metrics/groups/${subscription._id}`}>
              <i className="fa fa-fw fa-line-chart" /> {t('view_metrics')}
            </a>
          </p>
          <hr />
        </div>
      ))}
    </>
  )
}
