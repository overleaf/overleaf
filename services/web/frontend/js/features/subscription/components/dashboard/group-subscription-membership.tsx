import { Button } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import { MemberGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { LEAVE_GROUP_MODAL_ID } from './leave-group-modal'
import PremiumFeaturesLink from './premium-features-link'

type GroupSubscriptionMembershipProps = {
  subscription: MemberGroupSubscription
  isLast: boolean
}

export default function GroupSubscriptionMembership({
  subscription,
  isLast,
}: GroupSubscriptionMembershipProps) {
  const { t } = useTranslation()
  const { handleOpenModal, setLeavingGroupId } =
    useSubscriptionDashboardContext()

  const leaveGroup = () => {
    handleOpenModal(LEAVE_GROUP_MODAL_ID)
    setLeavingGroupId(subscription._id)
  }

  return (
    <div>
      <p>
        <Trans
          i18nKey="you_are_on_x_plan_as_member_of_group_subscription_y_administered_by_z"
          components={[<a href="/user/subscription/plans" />, <strong />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
          values={{
            planName: subscription.planLevelName,
            groupName: subscription.teamName || '',
            adminEmail: subscription.admin_id.email,
          }}
        />
      </p>
      {subscription.teamNotice && (
        <p>
          {/* Team notice is sanitized in SubscriptionViewModelBuilder */}
          <em>{subscription.teamNotice}</em>
        </p>
      )}
      {isLast && <PremiumFeaturesLink />}
      <span>
        <Button bsStyle="danger" onClick={leaveGroup}>
          {t('leave_group')}
        </Button>
      </span>
      <hr />
    </div>
  )
}
