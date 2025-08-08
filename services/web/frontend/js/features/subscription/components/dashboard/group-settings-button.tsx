import { RowLink } from '@/features/subscription/components/dashboard/row-link'
import { useTranslation } from 'react-i18next'
import { useLocation } from '@/shared/hooks/use-location'
import MaterialIcon from '@/shared/components/material-icon'
import OLTag from '@/shared/components/ol/ol-tag'
import { ManagedGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { sendMB } from '../../../../infrastructure/event-tracking'
import starIcon from '../../images/star-gradient.svg'

function AvailableWithGroupProfessionalBadge() {
  const { t } = useTranslation()
  const location = useLocation()

  const handleUpgradeClick = () => {
    sendMB('flex-upgrade', {
      location: 'ad-badge',
    })
    location.assign('/user/subscription/group/upgrade-subscription')
  }

  return (
    <OLTag
      prepend={<img aria-hidden="true" src={starIcon} alt="" />}
      contentProps={{
        className: 'mw-100',
        onClick: handleUpgradeClick,
      }}
    >
      <strong>{t('available_with_group_professional')}</strong>
    </OLTag>
  )
}

function useGroupSettingsButton(subscription: ManagedGroupSubscription) {
  const { t } = useTranslation()
  const subscriptionHasManagedUsers =
    subscription.features?.managedUsers === true
  const subscriptionHasGroupSSO = subscription.features?.groupSSO === true
  const heading = t('group_settings')

  let groupSettingRowSubText = ''
  if (subscriptionHasGroupSSO && subscriptionHasManagedUsers) {
    groupSettingRowSubText = t('manage_group_settings_subtext')
  } else if (subscriptionHasGroupSSO) {
    groupSettingRowSubText = t('manage_group_settings_subtext_group_sso')
  } else if (subscriptionHasManagedUsers) {
    groupSettingRowSubText = t('manage_group_settings_subtext_managed_users')
  }

  return {
    heading,
    groupSettingRowSubText,
  }
}

export function GroupSettingsButton({
  subscription,
}: {
  subscription: ManagedGroupSubscription
}) {
  const { heading, groupSettingRowSubText } =
    useGroupSettingsButton(subscription)

  return (
    <RowLink
      href={`/manage/groups/${subscription._id}/settings`}
      heading={heading}
      subtext={groupSettingRowSubText}
      icon="settings"
    />
  )
}

export function GroupSettingsButtonWithAdBadge({
  subscription,
}: {
  subscription: ManagedGroupSubscription
}) {
  const { heading, groupSettingRowSubText } =
    useGroupSettingsButton(subscription)

  return (
    <li className="list-group-item row-link">
      <div className="row-link-inner">
        <MaterialIcon type="settings" className="p-2 p-md-3 text-muted" />
        <div className="flex-grow-1 text-truncate text-muted">
          <strong>{heading}</strong>
          <div className="text-truncate">{groupSettingRowSubText}</div>
        </div>
        <span className="p-2 p-md-3">
          <AvailableWithGroupProfessionalBadge />
        </span>
      </div>
    </li>
  )
}
