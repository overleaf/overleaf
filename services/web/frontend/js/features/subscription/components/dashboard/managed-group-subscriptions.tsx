import GroupSettingsButton from '@/features/subscription/components/dashboard/group-settings-button'
import getMeta from '@/utils/meta'
import { Trans, useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { RowLink } from './row-link'
import { ManagedGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'

function ManagedGroupAdministrator({
  subscription,
}: {
  subscription: ManagedGroupSubscription
}) {
  const usersEmail = getMeta('ol-usersEmail')
  const values = {
    planName: subscription.planLevelName,
    groupName: subscription.teamName || '',
    adminEmail: subscription.admin_id.email,
  }

  const isAdmin = usersEmail === subscription.admin_id.email

  if (subscription.userIsGroupMember && !isAdmin) {
    return (
      <Trans
        i18nKey="you_are_a_manager_and_member_of_x_plan_as_member_of_group_subscription_y_administered_by_z"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/user/subscription/plans" />,
          // eslint-disable-next-line react/jsx-key
          <strong />,
        ]}
        values={values}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    )
  } else if (subscription.userIsGroupMember && isAdmin) {
    return (
      <Trans
        i18nKey="you_are_a_manager_and_member_of_x_plan_as_member_of_group_subscription_y_administered_by_z_you"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/user/subscription/plans" />,
          // eslint-disable-next-line react/jsx-key
          <strong />,
        ]}
        values={values}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    )
  } else if (isAdmin) {
    return (
      <Trans
        i18nKey="you_are_a_manager_of_x_plan_as_member_of_group_subscription_y_administered_by_z_you"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/user/subscription/plans" />,
          // eslint-disable-next-line react/jsx-key
          <strong />,
        ]}
        values={values}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    )
  }

  return (
    <Trans
      i18nKey="you_are_a_manager_of_x_plan_as_member_of_group_subscription_y_administered_by_z"
      components={[
        // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
        <a href="/user/subscription/plans" />,
        // eslint-disable-next-line react/jsx-key
        <strong />,
      ]}
      values={values}
      shouldUnescape
      tOptions={{ interpolation: { escapeValue: true } }}
    />
  )
}

export default function ManagedGroupSubscriptions() {
  const { t } = useTranslation()
  const { managedGroupSubscriptions } = useSubscriptionDashboardContext()

  if (!managedGroupSubscriptions) {
    return null
  }

  const groupSettingsEnabledFor = getMeta('ol-groupSettingsEnabledFor') || []

  return (
    <>
      {managedGroupSubscriptions.map(subscription => {
        return (
          <div key={`managed-group-${subscription._id}`}>
            <p>
              <ManagedGroupAdministrator subscription={subscription} />
            </p>
            <ul className="list-group p-0">
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
                <GroupSettingsButton subscription={subscription} />
              )}
              <RowLink
                href={`/metrics/groups/${subscription._id}`}
                heading={t('view_metrics')}
                subtext={t('view_metrics_group_subtext')}
                icon="insights"
              />
            </ul>
            <hr />
          </div>
        )
      })}
    </>
  )
}
