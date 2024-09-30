import { Trans, useTranslation } from 'react-i18next'
import { MemberGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import { LEAVE_GROUP_MODAL_ID } from './leave-group-modal'
import getMeta from '../../../../utils/meta'
import OLButton from '@/features/ui/components/ol/ol-button'

type GroupSubscriptionMembershipProps = {
  subscription: MemberGroupSubscription
}

export default function GroupSubscriptionMembership({
  subscription,
}: GroupSubscriptionMembershipProps) {
  const { t } = useTranslation()
  const { handleOpenModal, setLeavingGroupId } =
    useSubscriptionDashboardContext()

  const leaveGroup = () => {
    handleOpenModal(LEAVE_GROUP_MODAL_ID)
    setLeavingGroupId(subscription._id)
  }

  // Hide leave group button for managed users
  const hideLeaveButton = getMeta('ol-cannot-leave-group-subscription')

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
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      </p>
      {subscription.teamNotice && (
        <p>
          {/* Team notice is sanitized in SubscriptionViewModelBuilder */}
          <em>{subscription.teamNotice}</em>
        </p>
      )}
      {hideLeaveButton ? (
        <span>
          {' '}
          {t('need_to_leave')} {t('contact_group_admin')}{' '}
        </span>
      ) : (
        <span>
          <OLButton variant="danger" onClick={leaveGroup}>
            {t('leave_group')}
          </OLButton>
        </span>
      )}
      <hr />
    </div>
  )
}
