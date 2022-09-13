import Common from './groups/common'
import Institution from './groups/institution'
import ConfirmEmail from './groups/confirm-email'
import ReconfirmationInfo from './groups/affiliation/reconfirmation-info'

function UserNotifications() {
  return (
    <div className="user-notifications">
      <ul className="list-unstyled">
        <Common />
        <Institution />
        <ConfirmEmail />
        <ReconfirmationInfo />
      </ul>
    </div>
  )
}

export default UserNotifications
