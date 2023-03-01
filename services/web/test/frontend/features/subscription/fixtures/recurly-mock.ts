import {
  Address,
  CardElementOptions,
  ElementsInstance,
  PayPalConfig,
  PlanOptions,
  Recurly,
  RecurlyError,
  RecurlyOptions,
  RiskOptions,
  Tax,
  TokenPayload,
} from 'recurly__recurly-js'
import { SubscriptionPricingInstanceCustom } from '../../../../../types/recurly/pricing/subscription'

export const defaultSubscription = {
  id: '123',
  price: {
    base: {
      plan: {
        unit: '20.00',
        setup_fee: '0.00',
      },
    },
    next: {
      addons: '0.00',
      discount: '1.00',
      plan: '10.00',
      setup_fee: '0.00',
      subtotal: '9.00',
      tax: '1.20',
      total: '12.00',
    },
    now: {
      addons: '0.00',
      discount: '1.00',
      plan: '10.00',
      setup_fee: '0.00',
      subtotal: '9.00',
      tax: '1.20',
      total: '12.00',
    },
    taxes: [
      {
        tax_type: 'tax_type_1',
        region: 'EU',
        rate: '0.3',
      },
    ],
  },
  items: {
    coupon: {
      applies_for_months: 2,
      code: 'react',
      discount: {
        type: 'percent',
        rate: 0.2,
      },
      name: 'fake coupon',
      single_use: true,
    },
    currency: 'USD',
    plan: {
      code: 'asd',
      name: 'Standard (Collaborator)',
      period: {
        interval: '2',
        length: 5,
      },
      price: {
        '15': {
          unit_amount: 5,
          symbol: '$',
          setup_fee: 2,
        },
      },
      quantity: 1,
      tax_code: 'digital',
      tax_exempt: false,
      trial: {
        interval: 'weekly',
        length: 7,
      },
    },
  },
} as unknown as SubscriptionPricingInstanceCustom

class PayPalBase {
  protected constructor(config?: PayPalConfig) {
    Object.assign(this, config)
  }

  static PayPal = () => new this()

  destroy() {}

  on(_eventName: string, _callback: () => void) {}
}

class Card {
  protected fakeCardEl

  constructor() {
    this.fakeCardEl = document.createElement('div')
  }

  attach(el: HTMLElement) {
    this.fakeCardEl.dataset.testid = 'test-card-element'
    const input = document.createElement('input')
    input.style.border = '1px solid black'
    input.style.width = '50px'
    const cardNumberInput = input.cloneNode(true) as HTMLInputElement
    cardNumberInput.style.width = '200px'
    cardNumberInput.placeholder = 'XXXX-XXXX-XXXX-XXXX'

    this.fakeCardEl.appendChild(cardNumberInput)
    this.fakeCardEl.appendChild(input.cloneNode(true))
    this.fakeCardEl.appendChild(input.cloneNode(true))
    this.fakeCardEl.appendChild(input.cloneNode(true))
    el.appendChild(this.fakeCardEl)
  }

  on(eventName = 'change', callback: (state: Record<string, unknown>) => void) {
    this.fakeCardEl.querySelectorAll('input').forEach(node => {
      node.addEventListener(eventName, () => {
        const state = {
          valid: true,
        }
        callback(state)
      })
    })
  }
}

export class ElementsBase {
  protected constructor(config?: unknown) {
    Object.assign(this, config)
  }

  static Elements = () => new this()

  CardElement(_cardElementOptions?: CardElementOptions) {
    return new Card()
  }
}

export class ThreeDSecureBase {
  protected constructor(riskOptions?: RiskOptions) {
    Object.assign(this, riskOptions)
  }

  static ThreeDSecure = (_riskOptions: RiskOptions) => new this()

  on(_eventName = 'change', _callback: () => void) {}

  attach(el: HTMLElement) {
    const div = document.createElement('div')
    div.appendChild(document.createTextNode('3D challenge content'))
    el.appendChild(div)
  }
}

abstract class PricingBase {
  plan(_planCode: string, _options: PlanOptions) {
    return this
  }

  address(_address: Address) {
    return this
  }

  tax(_tax: Tax) {
    return this
  }

  currency(_currency: string) {
    return this
  }

  coupon(_coupon: string) {
    return this
  }

  catch(_callback?: (reason?: RecurlyError) => void) {
    return this
  }

  done(callback?: () => unknown) {
    callback?.()
    return this
  }

  on(_eventName: string, callback: () => void) {
    callback()
  }
}

const createSubscriptionClass = (classProps: unknown) => {
  return class extends PricingBase {
    protected constructor() {
      super()
      Object.assign(this, classProps)
    }

    static Subscription = () => new this()
  }
}

// Using `overrides` as currently can't stub/spy external files with cypress
export const createFakeRecurly = (classProps: unknown, overrides = {}) => {
  return {
    configure: (_options: RecurlyOptions) => {},
    token: (
      _elements: ElementsInstance,
      _second: unknown,
      handler: (
        err?: RecurlyError | null,
        recurlyBillingToken?: TokenPayload,
        threeDResultToken?: TokenPayload
      ) => void
    ) => {
      handler(undefined, undefined, { id: '123', type: '456' })
    },
    Elements: ElementsBase.Elements,
    PayPal: PayPalBase.PayPal,
    Pricing: createSubscriptionClass(classProps),
    Risk: () => ({
      ThreeDSecure: ThreeDSecureBase.ThreeDSecure,
    }),
    ...overrides,
  } as unknown as Recurly
}
