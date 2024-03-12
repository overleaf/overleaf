import { JSXElementConstructor, useState } from 'react'
import Common from './groups/common'
import Institution from './groups/institution'
import ConfirmEmail from './groups/confirm-email'
import ReconfirmationInfo from './groups/affiliation/reconfirmation-info'
import GroupsAndEnterpriseBanner from './groups-and-enterprise-banner'
import WritefullPremiumPromoBanner from './writefull-premium-promo-banner'
import GroupSsoSetupSuccess from './groups/group-sso-setup-success'
import INRBanner from './ads/inr-banner'
import getMeta from '../../../../utils/meta'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { sendMB } from '../../../../infrastructure/event-tracking'
import classNames from 'classnames'
import BRLBanner from './ads/brl-banner'

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
  const showBrlGeoBanner = getMeta('ol-showBrlGeoBanner', false)
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
      user?.writefull?.enabled === true ||
      window.writefull?.type === 'extension'

    if (show) {
      sendMB('promo-prompt', {
        location: 'dashboard-banner',
        page: '/project',
        name: 'writefull-premium',
      })
    }

    return show
  })
  const [dismissedWritefull, setDismissedWritefull] = useState(false)

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

        <WritefullPremiumPromoBanner
          show={showWritefull}
          setShow={setShowWritefull}
          onDismiss={() => {
            setDismissedWritefull(true)
          }}
        />
        {showBrlGeoBanner && <BRLBanner />}
      </ul>
    </div>
  )
}

export default UserNotifications
