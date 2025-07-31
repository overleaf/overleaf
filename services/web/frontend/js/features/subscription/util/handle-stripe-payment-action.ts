import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import { loadStripe } from '@stripe/stripe-js/pure'

export default async function handleStripePaymentAction(
  error: FetchError
): Promise<{ handled: boolean }> {
  const clientSecret = error?.data?.clientSecret
  const publicKey = error?.data?.publicKey

  if (clientSecret && publicKey) {
    const stripe = await loadStripe(publicKey)
    if (stripe) {
      const manualConfirmationFlow =
        await stripe.confirmCardPayment(clientSecret)
      if (manualConfirmationFlow.error) {
        const paymentIntentId = manualConfirmationFlow.error.payment_intent?.id
        try {
          await postJSON(
            `/user/subscription/void-change?payment_intent_id=${paymentIntentId}`
          )
        } catch (error) {
          // do nothing
        }
        return { handled: false }
      } else {
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
