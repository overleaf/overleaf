import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z } from '@overleaf/validation-tools'

// This mock stands in for Stripe's own API in web's acceptance tests. Unlike
// docstore/clsi, there is no internal production schema to mirror here --
// Stripe's real API is a third-party, open-ended surface -- so these schemas
// model the shape web's StripeClient actually sends to each route (per its
// call sites in modules/subscriptions/app/src/StripeClient.mjs) rather than
// only the handful of fields each handler destructures.
const stripeIdSchema = z.string().min(1)

// Stripe metadata values are always flat string->string maps.
const metadataSchema = z.record(z.string(), z.string())

const addressSchema = z.strictObject({
  city: z.string().optional(),
  country: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  postal_code: z.string().optional(),
  state: z.string().optional(),
})

const expandSchema = z.array(z.string())

const customerParamsSchema = z.strictObject({ id: stripeIdSchema })

const createCustomerSchema = z.object({
  body: z.strictObject({
    email: z.string(),
    name: z.string().optional(),
    address: addressSchema.optional(),
    tax: z
      .strictObject({
        validate_location: z.string().optional(),
      })
      .optional(),
    metadata: metadataSchema.optional(),
    tax_exempt: z.string().optional(),
    expand: expandSchema.optional(),
  }),
})

const listCustomersSchema = z.object({
  query: z.object({
    email: z.string().optional(),
    limit: z.coerce.number().int().optional(),
    expand: expandSchema.optional(),
  }),
})

const getCustomerSchema = z.object({ params: customerParamsSchema })

// Backs the generic `customers.update()` call, used with different subsets
// of these fields across StripeClient (subscription-creation flow, plain
// email/metadata updates, and customer-merge billing-details copy).
const updateCustomerSchema = z.object({
  params: customerParamsSchema,
  body: z.strictObject({
    email: z.string().optional(),
    name: z.string().optional(),
    address: addressSchema.optional(),
    tax: z
      .strictObject({
        validate_location: z.string().optional(),
      })
      .optional(),
    metadata: metadataSchema.optional(),
    tax_exempt: z.string().optional(),
    expand: expandSchema.optional(),
  }),
})

const createTaxIdSchema = z.object({
  params: customerParamsSchema,
  body: z.strictObject({
    type: z.string(),
    value: z.string(),
  }),
})

const deleteTaxIdSchema = z.object({
  params: z.strictObject({
    id: stripeIdSchema,
    taxId: stripeIdSchema,
  }),
})

const createSetupIntentSchema = z.object({
  body: z.strictObject({
    customer: stripeIdSchema,
    usage: z.string().optional(),
    metadata: metadataSchema.optional(),
  }),
})

const setupIntentParamsSchema = z.strictObject({ id: stripeIdSchema })

const getSetupIntentSchema = z.object({
  params: setupIntentParamsSchema,
  query: z.object({
    expand: expandSchema.optional(),
  }),
})

// Subscription item as sent by `subscriptions.create()` -- either a plain
// `{ price, quantity }` pair (the common case) or one carrying its own `id`
// (`subscriptionSchedules` phase items reuse the same shape upstream).
const subscriptionItemSchema = z.strictObject({
  id: z.string().optional(),
  price: stripeIdSchema,
  quantity: z.coerce.number().int().optional(),
})

const createSubscriptionSchema = z.object({
  body: z.strictObject({
    customer: stripeIdSchema,
    items: z.array(subscriptionItemSchema).optional(),
    collection_method: z.string().optional(),
    payment_behavior: z.string().optional(),
    payment_settings: z
      .strictObject({
        save_default_payment_method: z.string().optional(),
      })
      .optional(),
    default_payment_method: z.string().optional(),
    trial_period_days: z.coerce.number().int().optional(),
    metadata: metadataSchema.optional(),
    automatic_tax: z
      .strictObject({
        enabled: z.stringbool().optional(),
      })
      .optional(),
    discounts: z
      .array(
        z.strictObject({
          promotion_code: z.string().optional(),
        })
      )
      .optional(),
    expand: expandSchema.optional(),
  }),
})

const subscriptionParamsSchema = z.strictObject({ id: stripeIdSchema })

const getSubscriptionSchema = z.object({
  params: subscriptionParamsSchema,
  query: z.object({
    expand: expandSchema.optional(),
  }),
})

const listSubscriptionsSchema = z.object({
  query: z.object({
    customer: z.string().optional(),
    status: z.string().optional(),
    expand: expandSchema.optional(),
  }),
})

const listPricesSchema = z.object({
  query: z.object({
    active: z.stringbool().optional(),
    limit: z.coerce.number().int().optional(),
    lookup_keys: expandSchema.optional(),
    expand: expandSchema.optional(),
  }),
})

const priceParamsSchema = z.strictObject({ id: stripeIdSchema })

const getPriceSchema = z.object({ params: priceParamsSchema })

// `invoices.createPreview()` is called from two different sites with two
// different shapes: previewing a brand-new subscription (customer_details +
// subscription_details.items) and previewing the next invoice for an
// existing subscription (customer + subscription). Model both as optional
// since the mock's response doesn't depend on which shape was sent.
const createInvoicePreviewSchema = z.object({
  body: z.strictObject({
    customer: z.string().optional(),
    subscription: z.string().optional(),
    customer_details: z
      .strictObject({
        address: addressSchema.optional(),
        tax_ids: z
          .array(
            z.strictObject({
              type: z.string(),
              value: z.string(),
            })
          )
          .optional(),
        tax_exempt: z.string().optional(),
      })
      .optional(),
    automatic_tax: z
      .strictObject({
        enabled: z.stringbool().optional(),
      })
      .optional(),
    subscription_details: z
      .strictObject({
        items: z
          .array(
            z.strictObject({
              id: z.string().optional(),
              price: z.string().optional(),
              quantity: z.coerce.number().int().optional(),
            })
          )
          .optional(),
        proration_behavior: z.string().optional(),
      })
      .optional(),
    currency: z.string().optional(),
    preview_mode: z.string().optional(),
    discounts: z
      .array(
        z.strictObject({
          promotion_code: z.string().optional(),
        })
      )
      .optional(),
    expand: expandSchema.optional(),
  }),
})

const listPromotionCodesSchema = z.object({
  query: z.object({
    code: z.string().optional(),
    active: z.stringbool().optional(),
    expand: expandSchema.optional(),
  }),
})

class MockStripeApi extends AbstractMockApi {
  reset() {
    this.customers = {}
    this.setupIntents = {}
    this.subscriptions = {}
    this.prices = {}
    this.products = {}
    this.promotionCodes = []
    // Deterministic ids so tests don't depend on Date.now()/randomness.
    this.idCounter = 0
    // When rateLimited is set, every request is answered with a 429.
    this.rateLimited = false
    this.rateLimitedReason = null
    // Requests received per endpoint, so tests can assert what web refetches.
    this.requestCounts = {}
  }

  /**
   * Counting runs before Express matches a route, so endpoints with path params
   * are keyed by concrete path, e.g. 'GET /v1/prices/price_mock_1'.
   *
   * @param {string} endpoint
   * @returns {number}
   */
  getRequestCount(endpoint) {
    return this.requestCounts[endpoint] ?? 0
  }

  _countRequest(req) {
    const endpoint = `${req.method} ${req.path}`
    this.requestCounts[endpoint] = (this.requestCounts[endpoint] ?? 0) + 1
  }

  // Make every request fail with a 429, as Stripe does when we hit a rate-limit
  // bucket. Pass a `Stripe-Rate-Limited-Reason` value, or null for a header-less
  // 429 (an object-lock timeout).
  rateLimit(reason) {
    this.rateLimited = true
    this.rateLimitedReason = reason ?? null
  }

  _nextId(prefix) {
    this.idCounter += 1
    return `${prefix}_mock_${this.idCounter}`
  }

  addMockPrice({
    id,
    lookupKey,
    productId,
    unitAmount = 1500,
    currency = 'usd',
    interval = 'month',
    productMetadata = {},
  }) {
    const priceId = id || this._nextId('price')
    const prodId = productId || this._nextId('prod')
    const product = {
      id: prodId,
      object: 'product',
      active: true,
      metadata: productMetadata,
    }
    this.products[prodId] = product
    const price = {
      id: priceId,
      object: 'price',
      active: true,
      lookup_key: lookupKey || null,
      unit_amount: unitAmount,
      currency,
      recurring: { interval },
      product,
    }
    this.prices[priceId] = price
    return price
  }

  addMockSucceededSetupIntent({ customer, metadata = {}, paymentMethod }) {
    const id = this._nextId('seti')
    const setupIntent = {
      id,
      object: 'setup_intent',
      status: 'succeeded',
      client_secret: `${id}_secret_mock`,
      customer: typeof customer === 'string' ? customer : customer.id,
      payment_method: paymentMethod || this._nextId('pm'),
      last_setup_error: null,
      usage: 'off_session',
      metadata,
    }
    this.setupIntents[id] = setupIntent
    return setupIntent
  }

  // Render without every test having to seed the exact versioned lookup key
  _syntheticPrice(lookupKey) {
    const currency = lookupKey?.split('_').pop() || 'usd'
    return this.addMockPrice({ lookupKey, currency })
  }

  getMockSubscription(id) {
    return this.subscriptions[id]
  }

  setSubscriptionStatus(id, status) {
    const subscription = this.subscriptions[id]
    if (!subscription) {
      throw new Error(`no mock subscription with id ${id}`)
    }
    subscription.status = status
    return subscription
  }

  getMockCustomer(id) {
    return this.customers[id]
  }

  _customerResponse(customer) {
    return {
      ...customer,
      object: 'customer',
      tax_ids: { object: 'list', data: customer.tax_ids || [] },
    }
  }

  _expandSetupIntent(setupIntent, expand = []) {
    if (expand.includes('customer') && this.customers[setupIntent.customer]) {
      return {
        ...setupIntent,
        customer: this._customerResponse(this.customers[setupIntent.customer]),
      }
    }
    return setupIntent
  }

  _subscriptionResponse(subscription) {
    const customer = this.customers[subscription.customerId]
    const items = subscription.items.map(item => {
      const price = this.prices[item.priceId] || {
        id: item.priceId,
        object: 'price',
        unit_amount: 0,
        currency: subscription.currency,
        product: { id: this._nextId('prod'), object: 'product', metadata: {} },
      }
      return {
        id: item.id,
        object: 'subscription_item',
        quantity: item.quantity,
        price,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
      }
    })
    return {
      id: subscription.id,
      object: 'subscription',
      status: subscription.status,
      currency: subscription.currency,
      collection_method: subscription.collection_method,
      customer: customer
        ? this._customerResponse(customer)
        : subscription.customerId,
      items: { object: 'list', data: items },
      latest_invoice: subscription.latest_invoice,
      discounts: subscription.discounts || [],
      schedule: null,
      trial_start: subscription.trial_start || null,
      trial_end: subscription.trial_end || null,
      metadata: subscription.metadata || {},
    }
  }

  _notFound(res, resource) {
    res.status(404).json({
      error: {
        type: 'invalid_request_error',
        code: 'resource_missing',
        message: `No such ${resource}`,
      },
    })
  }

  applyRoutes() {
    // before the rate-limit check, so 429s are still counted
    this.app.use((req, res, next) => {
      this._countRequest(req)
      next()
    })

    this.app.use((req, res, next) => {
      if (!this.rateLimited) return next()
      // Stripe-Should-Retry: false so the SDK fails fast instead of retrying.
      res.set('Stripe-Should-Retry', 'false')
      if (this.rateLimitedReason) {
        res.set('Stripe-Rate-Limited-Reason', this.rateLimitedReason)
      }
      res.status(429).json({
        error: { type: 'rate_limit_error', message: 'Too many requests' },
      })
    })

    this.app.post('/v1/customers', (req, res) => {
      const { body } = parseReq(req, createCustomerSchema)
      const id = this._nextId('cus')
      const customer = {
        id,
        email: body.email,
        name: body.name,
        address: body.address,
        metadata: body.metadata || {},
        tax_exempt: body.tax_exempt || 'none',
        tax_ids: [],
      }
      this.customers[id] = customer
      res.json(this._customerResponse(customer))
    })

    this.app.get('/v1/customers', (req, res) => {
      const { query } = parseReq(req, listCustomersSchema)
      let data = Object.values(this.customers)
      if (query.email) {
        data = data.filter(c => c.email === query.email)
      }
      res.json({
        object: 'list',
        has_more: false,
        data: data.map(c => this._customerResponse(c)),
      })
    })

    this.app.get('/v1/customers/:id', (req, res) => {
      const { params } = parseReq(req, getCustomerSchema)
      const customer = this.customers[params.id]
      if (!customer) return this._notFound(res, 'customer')
      res.json(this._customerResponse(customer))
    })

    this.app.post('/v1/customers/:id', (req, res) => {
      const { params, body } = parseReq(req, updateCustomerSchema)
      const customer = this.customers[params.id]
      if (!customer) return this._notFound(res, 'customer')
      Object.assign(customer, body)
      res.json(this._customerResponse(customer))
    })

    this.app.post('/v1/customers/:id/tax_ids', (req, res) => {
      const { params, body } = parseReq(req, createTaxIdSchema)
      const customer = this.customers[params.id]
      if (!customer) return this._notFound(res, 'customer')
      const taxId = {
        id: this._nextId('txi'),
        object: 'tax_id',
        type: body.type,
        value: body.value,
      }
      customer.tax_ids.push(taxId)
      res.json(taxId)
    })

    this.app.delete('/v1/customers/:id/tax_ids/:taxId', (req, res) => {
      const { params } = parseReq(req, deleteTaxIdSchema)
      const customer = this.customers[params.id]
      if (customer) {
        customer.tax_ids = customer.tax_ids.filter(t => t.id !== params.taxId)
      }
      res.json({ id: params.taxId, object: 'tax_id', deleted: true })
    })

    this.app.post('/v1/setup_intents', (req, res) => {
      const { body } = parseReq(req, createSetupIntentSchema)
      const id = this._nextId('seti')
      const setupIntent = {
        id,
        object: 'setup_intent',
        status: 'requires_payment_method',
        client_secret: `${id}_secret_mock`,
        customer: body.customer,
        usage: body.usage,
        payment_method: null,
        last_setup_error: null,
        metadata: body.metadata || {},
      }
      this.setupIntents[id] = setupIntent
      res.json(setupIntent)
    })

    this.app.get('/v1/setup_intents/:id', (req, res) => {
      const { params, query } = parseReq(req, getSetupIntentSchema)
      const setupIntent = this.setupIntents[params.id]
      if (!setupIntent) return this._notFound(res, 'setup_intent')
      const expand = [].concat(query.expand || [])
      res.json(this._expandSetupIntent(setupIntent, expand))
    })

    this.app.post('/v1/subscriptions', (req, res) => {
      const { body } = parseReq(req, createSubscriptionSchema)
      const id = this._nextId('sub')
      const items = [].concat(body.items || []).map(item => ({
        id: this._nextId('si'),
        priceId: item.price,
        quantity: parseInt(item.quantity || '1', 10),
      }))
      const invoiceId = this._nextId('in')
      // default_incomplete payment behaviour -> subscription starts incomplete
      // with an open invoice carrying a confirmation secret.
      const subscription = {
        id,
        customerId: body.customer,
        status: body.trial_period_days ? 'trialing' : 'incomplete',
        currency: 'usd',
        collection_method: body.collection_method || 'charge_automatically',
        items,
        metadata: body.metadata || {},
        discounts: [],
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        latest_invoice: {
          id: invoiceId,
          object: 'invoice',
          status: 'open',
          total: 1500,
          subtotal_excluding_tax: 1500,
          total_excluding_tax: 1500,
          discounts: [],
          total_taxes: [],
          confirmation_secret: {
            object: 'confirmation_secret',
            client_secret: `${invoiceId}_secret_mock`,
          },
        },
      }
      this.subscriptions[id] = subscription
      res.json(this._subscriptionResponse(subscription))
    })

    this.app.get('/v1/subscriptions/:id', (req, res) => {
      const { params } = parseReq(req, getSubscriptionSchema)
      const subscription = this.subscriptions[params.id]
      if (!subscription) return this._notFound(res, 'subscription')
      res.json(this._subscriptionResponse(subscription))
    })

    this.app.get('/v1/subscriptions', (req, res) => {
      const { query } = parseReq(req, listSubscriptionsSchema)
      let data = Object.values(this.subscriptions)
      if (query.customer) {
        data = data.filter(s => s.customerId === query.customer)
      }
      res.json({
        object: 'list',
        has_more: false,
        data: data.map(s => this._subscriptionResponse(s)),
      })
    })

    this.app.get('/v1/prices', (req, res) => {
      const { query } = parseReq(req, listPricesSchema)
      let data = Object.values(this.prices)
      if (query.lookup_keys) {
        const keys = [].concat(query.lookup_keys)
        data = data.filter(p => keys.includes(p.lookup_key))
        for (const key of keys) {
          if (!data.some(p => p.lookup_key === key)) {
            data.push(this._syntheticPrice(key))
          }
        }
      }
      res.json({ object: 'list', has_more: false, data })
    })

    this.app.get('/v1/prices/:id', (req, res) => {
      const { params } = parseReq(req, getPriceSchema)
      const price = this.prices[params.id]
      if (!price) return this._notFound(res, 'price')
      res.json(price)
    })

    this.app.get('/v1/products', (req, res) => {
      res.json({
        object: 'list',
        has_more: false,
        data: Object.values(this.products),
      })
    })

    this.app.post('/v1/invoices/create_preview', (req, res) => {
      const { body } = parseReq(req, createInvoicePreviewSchema)
      res.json({
        object: 'invoice',
        currency: body.currency || 'usd',
        subtotal: 1500,
        total: 1500,
        total_excluding_tax: 1500,
        total_discount_amounts: [],
        total_taxes: [],
        discounts: [],
        lines: { object: 'list', has_more: false, data: [] },
      })
    })

    this.app.get('/v1/promotion_codes', (req, res) => {
      parseReq(req, listPromotionCodesSchema)
      res.json({
        object: 'list',
        has_more: false,
        data: this.promotionCodes,
      })
    })
  }
}

export default MockStripeApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockStripeApi
 * @static
 * @returns {MockStripeApi}
 */
