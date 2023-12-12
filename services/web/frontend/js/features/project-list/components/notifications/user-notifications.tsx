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
import LATAMBanner from './ads/latam-banner'
import getMeta from '../../../../utils/meta'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { sendMB } from '../../../../infrastructure/event-tracking'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

const WRITEFULL_PROMO_DELAY_MS = 24 * 60 * 60 * 1000 // 1 day
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
  const groupSubscriptionsPendingEnrollment: Subscription[] = getMeta(
    'ol-groupSubscriptionsPendingEnrollment',
    []
  )

  const showInrGeoBanner = getMeta('ol-showInrGeoBanner', false)
  const inrGeoBannerVariant = getMeta('ol-inrGeoBannerVariant', 'default')
  const inrGeoBannerSplitTestName = getMeta(
    'ol-inrGeoBannerSplitTestName',
    'unassigned'
  )
  const showLATAMBanner = getMeta('ol-showLATAMBanner', false)
  const writefullIntegrationSplitTestEnabled = isSplitTestEnabled(
    'writefull-integration'
  )

  // Temporary workaround to prevent also showing groups/enterprise banner
  const [showWritefull, setShowWritefull] = useState(() => {
    const dismissed = customLocalStorage.getItem(
      'has_dismissed_writefull_promo_banner'
    )
    if (dismissed) {
      return false
    }

    let show = false
    if (writefullIntegrationSplitTestEnabled) {
      // Show the Writefull promo 1 day after it has been enabled
      const user = getMeta('ol-user')
      if (user.writefull?.enabled) {
        const scheduledAt = customLocalStorage.getItem(
          'writefull_promo_scheduled_at'
        )
        if (scheduledAt == null) {
          customLocalStorage.setItem(
            'writefull_promo_scheduled_at',
            new Date(Date.now() + WRITEFULL_PROMO_DELAY_MS).toISOString()
          )
        } else if (new Date() >= new Date(scheduledAt)) {
          show = true
        }
      }
    } else {
      // Only show the Writefull extension promo on Chrome browsers
      show = isChromium() && getMeta('ol-showWritefullPromoBanner')
    }

    if (show) {
      sendMB('promo-prompt', {
        location: 'dashboard-banner',
        page: '/project',
        name: writefullIntegrationSplitTestEnabled
          ? 'writefull-premium'
          : 'writefull',
      })
    }

    return show
  })
  const [dismissedWritefull, setDismissedWritefull] = useState(false)

  return (
    <div className="user-notifications">
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
        {!showLATAMBanner &&
          !showInrGeoBanner &&
          !showWritefull &&
          !dismissedWritefull && <GroupsAndEnterpriseBanner />}
        {showLATAMBanner ? (
          <LATAMBanner />
        ) : showInrGeoBanner ? (
          <INRBanner
            variant={inrGeoBannerVariant}
            splitTestName={inrGeoBannerSplitTestName}
          />
        ) : null}
        {writefullIntegrationSplitTestEnabled ? (
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
