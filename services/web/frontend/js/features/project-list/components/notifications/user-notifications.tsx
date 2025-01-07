import { JSXElementConstructor } from 'react'
import Common from './groups/common'
import Institution from './groups/institution'
import ConfirmEmail from './groups/confirm-email'
import ReconfirmationInfo from './groups/affiliation/reconfirmation-info'
import GroupsAndEnterpriseBanner from './groups-and-enterprise-banner'
import GroupSsoSetupSuccess from './groups/group-sso-setup-success'
import getMeta from '../../../../utils/meta'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import GeoBanners from './geo-banners'
import AccessibilitySurveyBanner from './accessibility-survey-banner'
import {
  DeprecatedBrowser,
  isDeprecatedBrowser,
} from '@/shared/components/deprecated-browser'

const [enrollmentNotificationModule] = importOverleafModules(
  'managedGroupSubscriptionEnrollmentNotification'
)

const [usGovBannerModule] = importOverleafModules('usGovBanner')

const EnrollmentNotification: JSXElementConstructor<{
  groupId: string
  groupName: string
}> = enrollmentNotificationModule?.import.default

const USGovBanner: JSXElementConstructor<Record<string, never>> =
  usGovBannerModule?.import.default

function UserNotifications() {
  const groupSubscriptionsPendingEnrollment =
    getMeta('ol-groupSubscriptionsPendingEnrollment') || []

  return (
    <div className="user-notifications notification-list">
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
        <GeoBanners />
        <GroupsAndEnterpriseBanner />
        {USGovBanner && <USGovBanner />}

        <AccessibilitySurveyBanner />

        {isDeprecatedBrowser() && <DeprecatedBrowser />}
      </ul>
    </div>
  )
}

export default UserNotifications
