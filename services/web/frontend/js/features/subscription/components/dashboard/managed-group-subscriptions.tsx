import {
  GroupSettingsButton,
  GroupSettingsButtonWithAdBadge,
} from '@/features/subscription/components/dashboard/group-settings-button'
import getMeta from '@/utils/meta'
import { Trans, useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { RowLink } from './row-link'
import { ManagedGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { sendMB } from '@/infrastructure/event-tracking'
import { useFeatureFlag } from '@/shared/context/split-test-context'

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

  const usersEmail = getMeta('ol-usersEmail')

  const { managedGroupSubscriptions } = useSubscriptionDashboardContext()

  const combinedUserManagement = useFeatureFlag('combined-user-management')

  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const isSharingPermissionsEnabled = useFeatureFlag(
    'sharing-updates-sharing-permissions'
  )
  const isSharedWorkspaceEnabled = useFeatureFlag('shared-workspace')
  const aiTogglingSplitTestEnabled = useFeatureFlag('ai-toggling')

  if (!managedGroupSubscriptions) {
    return null
  }

  const groupSettingsAdvertisedFor =
    getMeta('ol-groupSettingsAdvertisedFor') || []
  const groupSettingsEnabledFor = getMeta('ol-groupSettingsEnabledFor') || []

  return (
    <>
      {managedGroupSubscriptions.map(subscription => {
        const isAdmin = usersEmail === subscription.admin_id.email

        // Shared Workspace is available to both managed and non-managed groups, so while the
        // `shared-workspace` split test has the group opted in, the section is rendered whenever
        // Overleaf Support hasn't disabled the feature for them.
        // AI Features toggling is narrower: it's only interactive for managed groups, so for
        // non-managed groups the section falls back to displaying notifications for features that
        // have been disabled by Overleaf Support. When the `ai-toggling` split test is enabled,
        // it's also displayed for non-managed groups that have the feature on. Both flags will be
        // deleted once their features are available to all groups.
        const shouldDisplayFeatureControls =
          (isSharedWorkspaceEnabled &&
            subscription.planLevelName === 'Pro' &&
            subscription.features?.sharedWorkspace !== false) ||
          (subscription.features?.aiToggling && aiTogglingSplitTestEnabled) ||
          subscription.managedUsersEnabled ||
          subscription.groupPolicy?.userCannotUseAIFeatures ||
          subscription.groupPolicy?.userCannotUseChat ||
          subscription.groupPolicy?.userCannotUseDropbox

        return (
          <div key={`managed-group-${subscription._id}`}>
            <h2 className="h3 fw-bold">{t('group_management')}</h2>
            <p>
              <ManagedGroupAdministrator subscription={subscription} />
            </p>
            <ul className="list-group p-0">
              {combinedUserManagement && (
                <RowLink
                  href={`/manage/groups/${subscription._id}/users`}
                  heading={t('user_management')}
                  subtext={t('manage_users_subtext')}
                  icon="groups"
                />
              )}
              {!combinedUserManagement && (
                <>
                  <RowLink
                    href={`/manage/groups/${subscription._id}/members`}
                    heading={t('group_members')}
                    subtext={t('manage_group_members_subtext')}
                    icon="groups"
                  />
                  <RowLink
                    href={`/manage/groups/${subscription._id}/managers`}
                    heading={t('group_managers')}
                    subtext={t('manage_managers_subtext')}
                    icon="manage_accounts"
                  />
                </>
              )}
              {groupSettingsEnabledFor?.includes(subscription._id) && (
                <GroupSettingsButton subscription={subscription} />
              )}
              {groupSettingsAdvertisedFor?.includes(subscription._id) && (
                <GroupSettingsButtonWithAdBadge subscription={subscription} />
              )}
              {isAdmin && (
                <>
                  {isSharingUpdatesEnabled &&
                    isSharingPermissionsEnabled &&
                    subscription.planLevelName === 'Pro' && (
                      <RowLink
                        href={`/manage/groups/${subscription._id}/sharing-permissions`}
                        heading={t('sharing_permissions')}
                        subtext={t('manage_group_sharing_permissions_subtext')}
                        icon="share"
                      />
                    )}
                  {shouldDisplayFeatureControls && (
                    <RowLink
                      href={`/manage/groups/${subscription._id}/feature-settings`}
                      heading={t('feature_controls')}
                      subtext={t('feature_settings_subtext')}
                      icon="toggle_off"
                    />
                  )}
                  <RowLink
                    href={`/manage/groups/${subscription._id}/audit-logs`}
                    heading={t('audit_logs')}
                    subtext={t('view_audit_logs_group_subtext')}
                    icon="list"
                    onClick={() =>
                      sendMB('group-audit-log-click', {
                        subscriptionId: subscription._id,
                      })
                    }
                  />
                </>
              )}
              <RowLink
                href={`/metrics/groups/${subscription._id}`}
                heading={t('usage_metrics')}
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
