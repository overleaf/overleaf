import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import getMeta from '../../../utils/meta'
import { loadStripe } from '@stripe/stripe-js/pure'

export default async function handleStripePaymentAction(
  error: FetchError
): Promise<{ handled: boolean }> {
  const clientSecret = error?.data?.clientSecret

  if (clientSecret) {
    // TODO: support both US and UK Stripe accounts
    const stripeUKPublicKey = getMeta('ol-stripeUKApiKey')
    const stripe = await loadStripe(stripeUKPublicKey)
    if (stripe) {
      const manualConfirmationFlow =
        await stripe.confirmCardPayment(clientSecret)
      if (!manualConfirmationFlow.error) {
        try {
          await postJSON(`/user/subscription/sync`)
        } catch (error) {
          // if the sync fails, there may be stale data until the webhook is
          // processed but we can't do any special handling for that in here
        }
        return { handled: true }
      }
    }
  }
  return { handled: false }
}
