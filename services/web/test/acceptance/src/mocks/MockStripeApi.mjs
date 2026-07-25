import AbstractMockApi from './AbstractMockApi.mjs'
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
    this.app.post('/v1/customers', (req, res) => {
      const id = this._nextId('cus')
      const customer = {
        id,
        email: req.body.email,
        name: req.body.name,
        address: req.body.address,
        metadata: req.body.metadata || {},
        tax_exempt: req.body.tax_exempt || 'none',
        tax_ids: [],
      }
      this.customers[id] = customer
      res.json(this._customerResponse(customer))
    })

    this.app.get('/v1/customers', (req, res) => {
      let data = Object.values(this.customers)
      if (req.query.email) {
        data = data.filter(c => c.email === req.query.email)
      }
      res.json({
        object: 'list',
        has_more: false,
        data: data.map(c => this._customerResponse(c)),
      })
    })

    this.app.get('/v1/customers/:id', (req, res) => {
      const customer = this.customers[req.params.id]
      if (!customer) return this._notFound(res, 'customer')
      res.json(this._customerResponse(customer))
    })

    this.app.post('/v1/customers/:id', (req, res) => {
      const customer = this.customers[req.params.id]
      if (!customer) return this._notFound(res, 'customer')
      Object.assign(customer, req.body)
      res.json(this._customerResponse(customer))
    })

    this.app.post('/v1/customers/:id/tax_ids', (req, res) => {
      const customer = this.customers[req.params.id]
      if (!customer) return this._notFound(res, 'customer')
      const taxId = {
        id: this._nextId('txi'),
        object: 'tax_id',
        type: req.body.type,
        value: req.body.value,
      }
      customer.tax_ids.push(taxId)
      res.json(taxId)
    })

    this.app.delete('/v1/customers/:id/tax_ids/:taxId', (req, res) => {
      const customer = this.customers[req.params.id]
      if (customer) {
        customer.tax_ids = customer.tax_ids.filter(
          t => t.id !== req.params.taxId
        )
      }
      res.json({ id: req.params.taxId, object: 'tax_id', deleted: true })
    })

    this.app.post('/v1/setup_intents', (req, res) => {
      const id = this._nextId('seti')
      const setupIntent = {
        id,
        object: 'setup_intent',
        status: 'requires_payment_method',
        client_secret: `${id}_secret_mock`,
        customer: req.body.customer,
        usage: req.body.usage,
        payment_method: null,
        last_setup_error: null,
        metadata: req.body.metadata || {},
      }
      this.setupIntents[id] = setupIntent
      res.json(setupIntent)
    })

    this.app.get('/v1/setup_intents/:id', (req, res) => {
      const setupIntent = this.setupIntents[req.params.id]
      if (!setupIntent) return this._notFound(res, 'setup_intent')
      const expand = [].concat(req.query.expand || [])
      res.json(this._expandSetupIntent(setupIntent, expand))
    })

    this.app.post('/v1/subscriptions', (req, res) => {
      const id = this._nextId('sub')
      const items = [].concat(req.body.items || []).map(item => ({
        id: this._nextId('si'),
        priceId: item.price,
        quantity: parseInt(item.quantity || '1', 10),
      }))
      const invoiceId = this._nextId('in')
      // default_incomplete payment behaviour -> subscription starts incomplete
      // with an open invoice carrying a confirmation secret.
      const subscription = {
        id,
        customerId: req.body.customer,
        status: req.body.trial_period_days ? 'trialing' : 'incomplete',
        currency: 'usd',
        collection_method: req.body.collection_method || 'charge_automatically',
        items,
        metadata: req.body.metadata || {},
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
      const subscription = this.subscriptions[req.params.id]
      if (!subscription) return this._notFound(res, 'subscription')
      res.json(this._subscriptionResponse(subscription))
    })

    this.app.get('/v1/subscriptions', (req, res) => {
      let data = Object.values(this.subscriptions)
      if (req.query.customer) {
        data = data.filter(s => s.customerId === req.query.customer)
      }
      res.json({
        object: 'list',
        has_more: false,
        data: data.map(s => this._subscriptionResponse(s)),
      })
    })

    this.app.get('/v1/prices', (req, res) => {
      let data = Object.values(this.prices)
      if (req.query.lookup_keys) {
        const keys = [].concat(req.query.lookup_keys)
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
      const price = this.prices[req.params.id]
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
      res.json({
        object: 'invoice',
        currency: req.body.currency || 'usd',
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
