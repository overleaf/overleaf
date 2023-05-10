import Common from './groups/common'
import Institution from './groups/institution'
import ConfirmEmail from './groups/confirm-email'
import ReconfirmationInfo from './groups/affiliation/reconfirmation-info'
import GroupsAndEnterpriseBanner from './groups-and-enterprise-banner'
import WritefullPromoBanner from './writefull-promo-banner'
import INRBanner from './ads/inr-banner'
import getMeta from '../../../../utils/meta'

function UserNotifications() {
  const showIRNBanner = getMeta('ol-showINRBanner')

  return (
    <div className="user-notifications">
      <ul className="list-unstyled">
        <Common />
        <Institution />
        <ConfirmEmail />
        <ReconfirmationInfo />
        {showIRNBanner ? <INRBanner /> : <GroupsAndEnterpriseBanner />}
        <WritefullPromoBanner />
      </ul>
    </div>
  )
}

export default UserNotifications
