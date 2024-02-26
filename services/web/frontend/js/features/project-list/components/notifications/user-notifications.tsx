import { JSXElementConstructor, useState } from 'react'
import Common from './groups/common'
import Institution from './groups/institution'
import ConfirmEmail from './groups/confirm-email'
import ReconfirmationInfo from './groups/affiliation/reconfirmation-info'
import GroupsAndEnterpriseBanner from './groups-and-enterprise-banner'
import WritefullPromoBanner from './writefull-promo-banner'
import WritefullPremiumPromoBanner from './writefull-premium-promo-banner'
import GroupSsoSetupSuccess from './groups/group-sso-setup-success'
import INRBanner from './ads/inr-banner'
import getMeta from '../../../../utils/meta'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { sendMB } from '../../../../infrastructure/event-tracking'
import classNames from 'classnames'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

const isChromium = () =>
  (window.navigator as any).userAgentData?.brands?.some(
    (item: { brand: string }) => item.brand === 'Chromium'
  )

type Subscription = {
  groupId: string
  groupName: string
}

const [enrollmentNotificationModule] = importOverleafModules(
  'managedGroupSubscriptionEnrollmentNotification'
)
const EnrollmentNotification: JSXElementConstructor<{
  groupId: string
  groupName: string
}> = enrollmentNotificationModule?.import.default

function UserNotifications() {
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean
  const groupSubscriptionsPendingEnrollment: Subscription[] = getMeta(
    'ol-groupSubscriptionsPendingEnrollment',
    []
  )

  const showInrGeoBanner = getMeta('ol-showInrGeoBanner', false)
  const writefullIntegrationSplitTestEnabled = isSplitTestEnabled(
    'writefull-integration'
  )
  const user = getMeta('ol-user')

  // Temporary workaround to prevent also showing groups/enterprise banner
  const [showWritefull, setShowWritefull] = useState(() => {
    const dismissed = customLocalStorage.getItem(
      'has_dismissed_writefull_promo_banner'
    )
    if (dismissed) {
      return false
    }

    const show =
      user?.writefull?.enabled === true || // show to any users who have writefull enabled regardless of split test
      (!writefullIntegrationSplitTestEnabled && // show old banner to users who are not in the split test, who are on chrome and havent dismissed
        isChromium() &&
        getMeta('ol-showWritefullPromoBanner'))

    if (show) {
      sendMB('promo-prompt', {
        location: 'dashboard-banner',
        page: '/project',
        name:
          user?.writefull?.enabled === true ||
          writefullIntegrationSplitTestEnabled
            ? 'writefull-premium'
            : 'writefull',
      })
    }

    return show
  })
  const [dismissedWritefull, setDismissedWritefull] = useState(false)

  const hasWritefullExtensionAlreadyInstalled =
    window.writefull?.type === 'extension'
  const usesWritefullIntegration =
    writefullIntegrationSplitTestEnabled || user?.writefull?.enabled
  const writefullBannerVariant =
    hasWritefullExtensionAlreadyInstalled || usesWritefullIntegration
      ? 'plans-page'
      : 'chrome-store'

  return (
    <div
      className={classNames('user-notifications', {
        'notification-list': newNotificationStyle,
      })}
    >
      <ul className="list-unstyled">
        {EnrollmentNotification &&
          groupSubscriptionsPendingEnrollment.map(subscription => (
            <EnrollmentNotification
              groupId={subscription.groupId}
              groupName={subscription.groupName}
              key={subscription.groupId}
            />
          ))}
        <GroupSsoSetupSuccess />
        <Common />
        <Institution />
        <ConfirmEmail />
        <ReconfirmationInfo />
        {!showWritefull && !dismissedWritefull && <GroupsAndEnterpriseBanner />}
        {showInrGeoBanner && <INRBanner />}
        {writefullBannerVariant === 'plans-page' ? (
          <WritefullPremiumPromoBanner
            show={showWritefull}
            setShow={setShowWritefull}
            onDismiss={() => {
              setDismissedWritefull(true)
            }}
          />
        ) : (
          <WritefullPromoBanner
            show={showWritefull}
            setShow={setShowWritefull}
            onDismiss={() => {
              setDismissedWritefull(true)
            }}
          />
        )}
      </ul>
    </div>
  )
}

export default UserNotifications
