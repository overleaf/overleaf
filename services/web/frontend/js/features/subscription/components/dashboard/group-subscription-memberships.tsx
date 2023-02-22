import { MemberGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import GroupSubscriptionMembership from './group-subscription-membership'
import LeaveGroupModal from './leave-group-modal'

export default function GroupSubscriptionMemberships() {
  const { memberGroupSubscriptions } = useSubscriptionDashboardContext()

  if (!memberGroupSubscriptions) {
    return null
  }

  const memberOnlyGroupSubscriptions = memberGroupSubscriptions.filter(
    subscription => !subscription.userIsGroupManager
  )

  return (
    <>
      {memberOnlyGroupSubscriptions.map(
        (subscription: MemberGroupSubscription, index: number) => (
          <GroupSubscriptionMembership
            subscription={subscription}
            isLast={index === memberOnlyGroupSubscriptions.length - 1}
            key={subscription._id}
          />
        )
      )}

      <LeaveGroupModal />
    </>
  )
}
