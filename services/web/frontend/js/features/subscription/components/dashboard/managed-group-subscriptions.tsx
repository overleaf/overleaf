import { Trans, useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { RowLink } from './row-link'

export default function ManagedGroupSubscriptions() {
  const { t } = useTranslation()
  const { managedGroupSubscriptions } = useSubscriptionDashboardContext()

  if (!managedGroupSubscriptions) {
    return null
  }

  const groupSettingsEnabledFor = getMeta(
    'ol-groupSettingsEnabledFor',
    []
  ) as string[]

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
          <RowLink
            href={`/manage/groups/${subscription._id}/members`}
            heading={t('manage_members')}
            subtext={t('manage_group_members_subtext')}
            icon="groups"
          />
          <RowLink
            href={`/manage/groups/${subscription._id}/managers`}
            heading={t('manage_group_managers')}
            subtext={t('manage_managers_subtext')}
            icon="manage_accounts"
          />
          {groupSettingsEnabledFor?.includes(subscription._id) && (
            <RowLink
              href={`/manage/groups/${subscription._id}/settings`}
              heading={t('manage_group_settings')}
              subtext={t('manage_group_settings_subtext')}
              icon="settings"
            />
          )}
          <RowLink
            href={`/metrics/groups/${subscription._id}`}
            heading={t('view_metrics')}
            subtext={t('view_metrics_group_subtext')}
            icon="insights"
          />
          <hr />
        </div>
      ))}
    </>
  )
}
