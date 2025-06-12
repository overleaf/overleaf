import { UserRef } from '../../../../../types/project/dashboard/api'
import { Subscription } from '../../../../../types/project/dashboard/subscription'
import getMeta from '@/utils/meta'

export function getUserName(user: UserRef) {
  if (user?.id === getMeta('ol-user_id')) {
    return 'You'
  }

  if (user) {
    const { firstName, lastName, email } = user

    if (firstName || lastName) {
      return [firstName, lastName].filter(n => n != null).join(' ')
    }

    if (email) {
      return email
    }
  }

  return 'None'
}

export function getUserSubscriptionState(subscription: Subscription) {
  if ('subscription' in subscription) {
    if (subscription.subscription.recurlyStatus?.state) {
      return subscription.subscription.recurlyStatus.state
    }
    if (subscription.subscription.paymentProvider) {
      return subscription.subscription.paymentProvider.state
    }
  }

  return null
}
