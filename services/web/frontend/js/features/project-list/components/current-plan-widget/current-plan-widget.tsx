import FreePlan from './free-plan'
import IndividualPlan from './individual-plan'
import GroupPlan from './group-plan'
import CommonsPlan from './commons-plan'
import getMeta from '../../../../utils/meta'

function CurrentPlanWidget() {
  const usersBestSubscription = getMeta('ol-usersBestSubscription')

  if (!usersBestSubscription) {
    return null
  }

  const { type } = usersBestSubscription
  const isFreePlan = type === 'free'
  const isIndividualPlan = type === 'individual'
  const isGroupPlan = type === 'group'
  const isCommonsPlan = type === 'commons'

  const featuresPageURL = '/learn/how-to/Overleaf_premium_features'

  let currentPlan

  if (isFreePlan) {
    currentPlan = <FreePlan featuresPageURL={featuresPageURL} />
  }

  if (isIndividualPlan) {
    currentPlan = (
      <IndividualPlan
        remainingTrialDays={usersBestSubscription.remainingTrialDays}
        plan={usersBestSubscription.plan}
        featuresPageURL={featuresPageURL}
      />
    )
  }

  if (isGroupPlan) {
    currentPlan = (
      <GroupPlan
        subscription={usersBestSubscription.subscription}
        remainingTrialDays={usersBestSubscription.remainingTrialDays}
        plan={usersBestSubscription.plan}
        featuresPageURL={featuresPageURL}
      />
    )
  }

  if (isCommonsPlan) {
    currentPlan = (
      <CommonsPlan
        subscription={usersBestSubscription.subscription}
        plan={usersBestSubscription.plan}
        featuresPageURL={featuresPageURL}
      />
    )
  }

  return <div className="current-plan">{currentPlan}</div>
}

export default CurrentPlanWidget
