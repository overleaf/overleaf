import Stripe from 'stripe'
import { RecurlyPlanCode } from '../subscription/plan'

type MetadataPlanCode = Exclude<
  RecurlyPlanCode,
  | 'professional_free_trial_7_days'
  | 'student_free_trial_7_days'
  | 'collaborator_free_trial_7_days'
>

export type ProductMetadata = Stripe.Metadata & {
  planCode: MetadataPlanCode
  addOnCode?: Extract<RecurlyPlanCode, 'assistant'>
}

export type SubscriptionMetadata = Stripe.Metadata & {
  itm_campaign?: string
  itm_content?: string
  itm_referrer?: string
  checkoutSource?: 'hosted-checkout' | 'elements-checkout'
}
