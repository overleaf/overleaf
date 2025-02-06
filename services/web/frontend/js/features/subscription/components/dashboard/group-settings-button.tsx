import { RowLink } from '@/features/subscription/components/dashboard/row-link'
import { useTranslation } from 'react-i18next'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useLocation } from '@/shared/hooks/use-location'
import MaterialIcon from '@/shared/components/material-icon'
import OLTag from '@/features/ui/components/ol/ol-tag'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'
import { ManagedGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { sendMB } from '../../../../infrastructure/event-tracking'

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
      prepend={
        <img
          aria-hidden="true"
          src="/img/material-icons/star-gradient.svg"
          alt=""
        />
      }
      contentProps={{
        className: bsVersion({ bs5: 'mw-100' }),
        onClick: handleUpgradeClick,
      }}
    >
      <strong>{t('available_with_group_professional')}</strong>
    </OLTag>
  )
}

function useGroupSettingsButton(subscription: ManagedGroupSubscription) {
  const { t } = useTranslation()
  const isFlexibleGroupLicensing = useFeatureFlag('flexible-group-licensing')
  const subscriptionHasManagedUsers =
    subscription.features?.managedUsers === true
  const subscriptionHasGroupSSO = subscription.features?.groupSSO === true
  const heading = isFlexibleGroupLicensing
    ? t('group_settings')
    : t('manage_group_settings')

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
    <BootstrapVersionSwitcher
      bs3={
        <div className="row-link text-muted">
          <div className="icon">
            <MaterialIcon type="settings" />
          </div>
          <div className="text">
            <div className="heading">{heading}</div>
            <div className="subtext">{groupSettingRowSubText}</div>
          </div>
          <span className="badge-group-settings">
            <AvailableWithGroupProfessionalBadge />
          </span>
        </div>
      }
      bs5={
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
      }
    />
  )
}
