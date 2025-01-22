import FreePlan from './free-plan'
import IndividualPlan from './individual-plan'
import GroupPlan from './group-plan'
import CommonsPlan from './commons-plan'
import PausedPlan from './paused-plan'
import getMeta from '../../../../utils/meta'

function CurrentPlanWidget() {
  const usersBestSubscription = getMeta('ol-usersBestSubscription')

  if (!usersBestSubscription) {
    return null
  }

  const { type } = usersBestSubscription
  const isFreePlan = type === 'free' || type === 'standalone-ai-add-on'
  const isIndividualPlan = type === 'individual'
  const isGroupPlan = type === 'group'
  const isCommonsPlan = type === 'commons'
  const isPaused =
    isIndividualPlan &&
    usersBestSubscription.subscription?.recurlyStatus?.state === 'paused'

  const featuresPageURL = '/learn/how-to/Overleaf_premium_features'
  const subscriptionPageUrl = '/user/subscription'

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

  if (isPaused) {
    currentPlan = <PausedPlan subscriptionPageUrl={subscriptionPageUrl} />
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
