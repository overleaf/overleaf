import { JSXElementConstructor, useState } from 'react'
import Common from './groups/common'
import Institution from './groups/institution'
import ConfirmEmail from './groups/confirm-email'
import ReconfirmationInfo from './groups/affiliation/reconfirmation-info'
import GroupsAndEnterpriseBanner from './groups-and-enterprise-banner'
import WritefullPromoBanner from './writefull-promo-banner'
import INRBanner from './ads/inr-banner'
import LATAMBanner from './ads/latam-banner'
import getMeta from '../../../../utils/meta'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { sendMB } from '../../../../infrastructure/event-tracking'

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

  // Temporary workaround to prevent also showing groups/enterprise banner
  const [showWritefull, setShowWritefull] = useState(() => {
    if (isChromium()) {
      const show =
        getMeta('ol-showWritefullPromoBanner') &&
        !customLocalStorage.getItem('has_dismissed_writefull_promo_banner')
      if (show) {
        sendMB('promo-prompt', {
          location: 'dashboard-banner',
          page: '/project',
          name: 'writefull',
        })
      }
      return show
    }
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
        <WritefullPromoBanner
          show={showWritefull}
          setShow={setShowWritefull}
          onDismiss={() => {
            setDismissedWritefull(true)
          }}
        />
      </ul>
    </div>
  )
}

export default UserNotifications
