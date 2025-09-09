import _ from 'lodash'
import { groupPriceByUsageTypeAndSize, plans } from '../fixtures/plans'
import { MetaTag } from '@/utils/meta'

export function setupSubscriptionDashContext(options?: {
  metaTags?: MetaTag[]
  recurlyNotLoaded?: boolean
  queryingRecurly?: boolean
  currencyCode?: string
}) {
  options?.metaTags?.forEach(tag =>
    window.metaAttributesCache.set(tag!.name, tag!.value)
  )
  window.metaAttributesCache.set('ol-user', {})
  if (!options?.recurlyNotLoaded) {
    // @ts-ignore
    global.recurly = {
      configure: () => {},
      Pricing: {
        Subscription: () => {
          return {
            plan: (planCode: string) => {
              let plan
              const isGroupPlan = planCode.includes('group')
              if (isGroupPlan) {
                const [, planType, size, usage] = planCode.split('_')
                const currencyCode = options?.currencyCode || 'USD'
                plan = _.get(groupPriceByUsageTypeAndSize, [
                  usage,
                  planType,
                  currencyCode,
                  size,
                ])
              } else {
                plan = plans.find(p => p.planCode === planCode)
              }

              const response = {
                next: {
                  total: plan?.price_in_cents
                    ? plan.price_in_cents / 100
                    : undefined,
                },
              }
              return {
                currency: () => {
                  return {
                    catch: () => {
                      return {
                        done: (callback: (response: object) => void) => {
                          if (!options?.queryingRecurly) {
                            return callback(response)
                          }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      },
    }
  }
}
