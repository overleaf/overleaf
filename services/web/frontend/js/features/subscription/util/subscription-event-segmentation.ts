import { PaidSubscription } from '@ol-types/subscription/dashboard/subscription'
import isInFreeTrial from './is-in-free-trial'

/**
 * The shared segmentation for `subscription-page-*` analytics events, so that
 * every event fired from the subscription dashboard can be compared against the
 * `subscription-page-view` event recorded server side.
 */
export default function getSubscriptionEventSegmentation(
  subscription?: PaidSubscription
) {
  return {
    plan_code: subscription?.planCode,
    billing_cycle: subscription?.plan
      ? subscription.plan.annual
        ? 'annual'
        : 'monthly'
      : undefined,
    is_trial: isInFreeTrial(subscription?.payment?.trialEndsAt),
    currency: subscription?.payment?.currency,
  }
}
