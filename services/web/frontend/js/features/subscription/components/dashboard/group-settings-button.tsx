import { RowLink } from '@/features/subscription/components/dashboard/row-link'
import getMeta from '@/utils/meta'
import { useTranslation } from 'react-i18next'
import { ManagedGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'

export default function GroupSettingsButton({
  subscription,
}: {
  subscription: ManagedGroupSubscription
}) {
  const { t } = useTranslation()

  const { groupSSOEnabled } = getMeta('ol-ExposedSettings')

  const subscriptionHasManagedUsers =
    subscription.features?.managedUsers !== false
  const subscriptionHasGroupSSO =
    subscription.features?.groupSSO === true ||
    (groupSSOEnabled && subscription.features?.groupSSO === null)

  let groupSettingRowSubText = ''
  if (subscriptionHasGroupSSO && subscriptionHasManagedUsers) {
    groupSettingRowSubText = t('manage_group_settings_subtext')
  } else if (subscriptionHasGroupSSO) {
    groupSettingRowSubText = t('manage_group_settings_subtext_group_sso')
  } else if (subscriptionHasManagedUsers) {
    groupSettingRowSubText = t('manage_group_settings_subtext_managed_users')
  }

  return (
    <RowLink
      href={`/manage/groups/${subscription._id}/settings`}
      heading={t('manage_group_settings')}
      subtext={groupSettingRowSubText}
      icon="settings"
    />
  )
}
