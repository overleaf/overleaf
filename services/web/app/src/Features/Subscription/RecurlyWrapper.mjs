import OError from '@overleaf/o-error'
import {
  fetchStringWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'
import xml2js from 'xml2js'
import logger from '@overleaf/logger'
import Errors from '../Errors/Errors.js'
import SubscriptionErrors from './Errors.mjs'
import { callbackify } from '@overleaf/promise-utils'
import RecurlyMetrics from './RecurlyMetrics.mjs'

/**
 * Updates the email address of a Recurly account
 *
 * @param userId
 * @param newAccountEmail - the new email address to set for the Recurly account
 */
async function updateAccountEmailAddress(userId, newAccountEmail) {
  const data = {
    email: newAccountEmail,
  }
  let requestBody
  try {
    requestBody = RecurlyWrapper._buildXml('account', data)
  } catch (error) {
    throw OError.tag(error, 'error building xml', {
      accountId: userId,
      newEmail: newAccountEmail,
    })
  }

  const { body } = await RecurlyWrapper.promises.apiRequest({
    url: `accounts/${userId}`,
    method: 'PUT',
    body: requestBody,
  })
  return await RecurlyWrapper.promises._parseAccountXml(body)
}

const promises = {
  _paypal: {
    async checkAccountExists(cache) {
      const { user } = cache
      logger.debug(
        { userId: user._id },
        'checking if recurly account exists for user'
      )
      let response, body
      try {
        ;({ response, body } = await RecurlyWrapper.promises.apiRequest({
          url: `accounts/${user._id}`,
          method: 'GET',
          expect404: true,
        }))
      } catch (error) {
        OError.tag(
          error,
          'error response from recurly while checking account',
          {
            user_id: user._id,
          }
        )
        throw error
      }
      if (response.status === 404) {
        // actually not an error in this case, just no existing account
        logger.debug(
          { userId: user._id },
          'user does not currently exist in recurly, proceed'
        )
        cache.userExists = false
        return cache
      }
      logger.debug({ userId: user._id }, 'user appears to exist in recurly')
      try {
        const account = await RecurlyWrapper.promises._parseAccountXml(body)
        cache.userExists = true
        cache.account = account
        return cache
      } catch (err) {
        OError.tag(err, 'error parsing account', {
          user_id: user._id,
        })
        throw err
      }
    },
    async createAccount(cache) {
      const { user } = cache
      const { subscriptionDetails } = cache
      if (cache.userExists) {
        return cache
      }

      const address = getAddressFromSubscriptionDetails(
        subscriptionDetails,
        false
      )

      const data = {
        account_code: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        address,
      }
      let requestBody
      try {
        requestBody = RecurlyWrapper._buildXml('account', data)
      } catch (error) {
        throw OError.tag(error, 'error building xml', { user_id: user._id })
      }

      let body
      try {
        ;({ body } = await RecurlyWrapper.promises.apiRequest({
          url: 'accounts',
          method: 'POST',
          body: requestBody,
        }))
      } catch (error) {
        OError.tag(
          error,
          'error response from recurly while creating account',
          { user_id: user._id }
        )
        throw error
      }
      try {
        cache.account = await RecurlyWrapper.promises._parseAccountXml(body)
        return cache
      } catch (err) {
        OError.tag(err, 'error creating account', {
          user_id: user._id,
        })
        throw err
      }
    },
    async createBillingInfo(cache) {
      const { user } = cache
      const { recurlyTokenIds } = cache
      logger.debug({ userId: user._id }, 'creating billing info in recurly')
      const accountCode = cache?.account?.account_code
      if (!accountCode) {
        throw new Error('no account code at createBillingInfo stage')
      }
      const data = { token_id: recurlyTokenIds.billing }
      let requestBody
      try {
        requestBody = RecurlyWrapper._buildXml('billing_info', data)
      } catch (error) {
        throw OError.tag(error, 'error building xml', { user_id: user._id })
      }
      let body
      try {
        ;({ body } = await RecurlyWrapper.promises.apiRequest({
          url: `accounts/${accountCode}/billing_info`,
          method: 'POST',
          body: requestBody,
        }))
      } catch (error) {
        OError.tag(
          error,
          'error response from recurly while creating billing info',
          { user_id: user._id }
        )
        throw error
      }
      try {
        cache.billingInfo =
          await RecurlyWrapper.promises._parseBillingInfoXml(body)
        return cache
      } catch (err) {
        OError.tag(err, 'error creating billing info', {
          user_id: user._id,
          accountCode,
        })
        throw err
      }
    },

    async setAddressAndCompanyBillingInfo(cache) {
      const { user } = cache
      const { subscriptionDetails } = cache
      logger.debug(
        { userId: user._id },
        'setting billing address and company info in recurly'
      )
      const accountCode = cache?.account?.account_code
      if (!accountCode) {
        throw new Error(
          'no account code at setAddressAndCompanyBillingInfo stage'
        )
      }

      const addressAndCompanyBillingInfo = getAddressFromSubscriptionDetails(
        subscriptionDetails,
        true
      )

      let requestBody
      try {
        requestBody = RecurlyWrapper._buildXml(
          'billing_info',
          addressAndCompanyBillingInfo
        )
      } catch (error) {
        throw OError.tag(error, 'error building xml', { user_id: user._id })
      }

      let body
      try {
        ;({ body } = await RecurlyWrapper.promises.apiRequest({
          url: `accounts/${accountCode}/billing_info`,
          method: 'PUT',
          body: requestBody,
        }))
      } catch (error) {
        OError.tag(error, 'error response from recurly while setting address', {
          user_id: user._id,
        })
        throw error
      }
      try {
        cache.billingInfo =
          await RecurlyWrapper.promises._parseBillingInfoXml(body)
        return cache
      } catch (err) {
        if (err) {
          OError.tag(err, 'error updating billing info', {
            user_id: user._id,
          })
          throw err
        }
      }
    },
    async createSubscription(cache) {
      const { user } = cache
      const { subscriptionDetails } = cache
      logger.debug({ userId: user._id }, 'creating subscription in recurly')
      const data = {
        plan_code: subscriptionDetails.plan_code,
        currency: subscriptionDetails.currencyCode,
        coupon_code: subscriptionDetails.coupon_code,
        account: {
          account_code: user._id,
        },
      }
      if (subscriptionDetails.subscription_add_ons) {
        data.subscription_add_ons = subscriptionDetails.subscription_add_ons
      }
      const customFields =
        getCustomFieldsFromSubscriptionDetails(subscriptionDetails)
      if (customFields) {
        data.custom_fields = customFields
      }
      let requestBody
      try {
        requestBody = RecurlyWrapper._buildXml('subscription', data)
      } catch (error) {
        throw OError.tag(error, 'error building xml', { user_id: user._id })
      }

      let body
      try {
        ;({ body } = await RecurlyWrapper.promises.apiRequest({
          url: 'subscriptions',
          method: 'POST',
          body: requestBody,
        }))
      } catch (error) {
        OError.tag(
          error,
          'error response from recurly while creating subscription',
          { user_id: user._id }
        )
        throw error
      }
      try {
        cache.subscription =
          await RecurlyWrapper.promises._parseSubscriptionXml(body)
        return cache
      } catch (err) {
        OError.tag(err, 'error creating subscription', {
          user_id: user._id,
        })
        throw err
      }
    },
  },

  async _createPaypalSubscription(user, subscriptionDetails, recurlyTokenIds) {
    logger.debug(
      { userId: user._id },
      'starting process of creating paypal subscription'
    )
    // We use waterfall through each of these actions in sequence
    // passing a `cache` object along the way. The cache is initialized
    // with required data, and `async.apply` to pass the cache to the first function
    const cache = { user, recurlyTokenIds, subscriptionDetails }
    let result
    try {
      result = await RecurlyWrapper.promises._paypal.checkAccountExists(cache)
      result = await RecurlyWrapper.promises._paypal.createAccount(result)
      result = await RecurlyWrapper.promises._paypal.createBillingInfo(result)
      result =
        await RecurlyWrapper.promises._paypal.setAddressAndCompanyBillingInfo(
          result
        )
      result = await RecurlyWrapper.promises._paypal.createSubscription(result)
    } catch (err) {
      OError.tag(err, 'error in paypal subscription creation process', {
        user_id: user._id,
      })
      throw err
    }
    if (!result.subscription) {
      const err = new Error('no subscription object in result')
      OError.tag(err, 'error in paypal subscription creation process', {
        user_id: user._id,
      })
      throw err
    }
    logger.debug(
      { userId: user._id },
      'done creating paypal subscription for user'
    )
    return result.subscription
  },

  async _createCreditCardSubscription(
    user,
    subscriptionDetails,
    recurlyTokenIds
  ) {
    const data = {
      plan_code: subscriptionDetails.plan_code,
      currency: subscriptionDetails.currencyCode,
      coupon_code: subscriptionDetails.coupon_code,
      account: {
        account_code: user._id,
        email: user.email,
        first_name: subscriptionDetails.first_name || user.first_name,
        last_name: subscriptionDetails.last_name || user.last_name,
        billing_info: {
          token_id: recurlyTokenIds.billing,
        },
      },
    }
    if (recurlyTokenIds.threeDSecureActionResult) {
      data.account.billing_info.three_d_secure_action_result_token_id =
        recurlyTokenIds.threeDSecureActionResult
    }
    if (subscriptionDetails.subscription_add_ons) {
      data.subscription_add_ons = subscriptionDetails.subscription_add_ons
    }

    const customFields =
      getCustomFieldsFromSubscriptionDetails(subscriptionDetails)
    if (customFields) {
      data.custom_fields = customFields
    }
    let requestBody
    try {
      requestBody = RecurlyWrapper._buildXml('subscription', data)
    } catch (error) {
      throw OError.tag(error, 'error building xml', { user_id: user._id })
    }

    const { response, body } = await RecurlyWrapper.promises.apiRequest({
      url: 'subscriptions',
      method: 'POST',
      body: requestBody,
      expect422: true,
    })

    if (response.status === 422) {
      return await RecurlyWrapper.promises._handle422Response(body)
    } else {
      return await RecurlyWrapper.promises._parseSubscriptionXml(body)
    }
  },

  async createSubscription(user, subscriptionDetails, recurlyTokenIds) {
    const { isPaypal } = subscriptionDetails
    logger.debug(
      { userId: user._id, isPaypal },
      'setting up subscription in recurly'
    )
    const fn = isPaypal
      ? RecurlyWrapper.promises._createPaypalSubscription
      : RecurlyWrapper.promises._createCreditCardSubscription
    return fn(user, subscriptionDetails, recurlyTokenIds)
  },

  /**
   * @param options - the options to pass to the request library
   * @returns {Promise<{ response: unknown, body: string}>}
   */
  async apiRequest({ expect404, expect422, url, qs, ...fetchOptions }) {
    const fetchUrl = new URL(RecurlyWrapper.apiUrl)
    fetchUrl.pathname =
      fetchUrl.pathname !== '/' ? `${fetchUrl.pathname}/${url}` : url

    if (qs) {
      for (const [key, value] of Object.entries(qs)) {
        fetchUrl.searchParams.set(key, value)
      }
    }
    fetchOptions.headers = {
      Authorization: `Basic ${Buffer.from(
        Settings.apis.recurly.apiKey
      ).toString('base64')}`,
      Accept: 'application/xml',
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Api-Version': Settings.apis.recurly.apiVersion,
    }

    try {
      const { body, response } = await fetchStringWithResponse(
        fetchUrl,
        fetchOptions
      )
      RecurlyMetrics.recordMetricsFromResponse(response)
      return { body, response }
    } catch (error) {
      if (error instanceof RequestFailedError) {
        RecurlyMetrics.recordMetricsFromResponse(error.response)
        if (error.response.status === 404 && expect404) {
          return { response: error.response, body: null }
        } else if (error.response.status === 422 && expect422) {
          return { response: error.response, body: error.body }
        }

        if (fetchOptions.headers.Authorization) {
          fetchOptions.headers.Authorization = 'REDACTED'
        }
        logger.warn(
          {
            err: error,
            body: error.body,
            options: fetchOptions,
            url: fetchUrl.href,
            statusCode: error.response?.status,
          },
          'error returned from recurly'
        )
        throw new OError(
          `Recurly API returned with status code: ${error.response.status}`,
          { statusCode: error.response.status }
        )
      } else {
        throw error
      }
    }
  },

  async getSubscriptions(accountId) {
    const { body } = await RecurlyWrapper.promises.apiRequest({
      url: `accounts/${accountId}/subscriptions`,
    })
    return await RecurlyWrapper.promises._parseXml(body)
  },

  async getSubscription(subscriptionId, options) {
    let url
    if (!options) {
      options = {}
    }

    if (options.recurlyJsResult) {
      url = `recurly_js/result/${subscriptionId}`
    } else {
      url = `subscriptions/${subscriptionId}`
    }

    const { body } = await RecurlyWrapper.promises.apiRequest({
      url,
    })

    const recurlySubscription =
      await RecurlyWrapper.promises._parseSubscriptionXml(body)

    if (options.includeAccount) {
      let accountId
      if (recurlySubscription.account && recurlySubscription.account.url) {
        accountId = recurlySubscription.account.url.match(/accounts\/(.*)/)[1]
      } else {
        throw new Error("I don't understand the response from Recurly")
      }

      recurlySubscription.account =
        await RecurlyWrapper.promises.getAccount(accountId)

      return recurlySubscription
    } else {
      return recurlySubscription
    }
  },

  /**
   * @typedef {{getNextPage: () => Promise<PageData>, items: any[]}} PageData
   */

  async getPaginatedEndpoint(resource, queryParams) {
    let allItems = []
    let items

    /** @type {() => Promise<PageData>} */
    let getNextPage = promises.getPaginatedEndpointIterator(
      resource,
      queryParams
    )
    while (getNextPage) {
      ;({ items, getNextPage } = await getNextPage())
      allItems = allItems.concat(items)
      logger.debug(`total now ${allItems.length}`)
    }
    return allItems
  },

  /**
   * @returns {() => Promise<PageData>}
   */
  getPaginatedEndpointIterator(resource, queryParams) {
    queryParams.per_page = queryParams.per_page || 200
    const getPage = async (cursor = null) => {
      const opts = {
        url: resource,
        qs: queryParams,
      }
      if (cursor) {
        opts.qs.cursor = cursor
      }
      const { response, body } = await RecurlyWrapper.promises.apiRequest(opts)

      const data = await RecurlyWrapper.promises._parseXml(body)

      const items = data[resource]
      logger.debug(`got ${items.length} items in this page`)
      const match = response.headers.link?.match(/cursor=([0-9.]+%3A[0-9.]+)&/)
      const nextCursor = match && match[1]
      return {
        items,
        getNextPage:
          nextCursor && (() => getPage(decodeURIComponent(nextCursor))),
      }
    }
    return getPage
  },

  async getAccount(accountId) {
    const { body } = await RecurlyWrapper.promises.apiRequest({
      url: `accounts/${accountId}`,
    })
    return await RecurlyWrapper.promises._parseAccountXml(body)
  },

  updateAccountEmailAddress,

  async getCoupon(couponCode) {
    const opts = { url: `coupons/${couponCode}` }
    const { body } = await RecurlyWrapper.promises.apiRequest(opts)
    return await RecurlyWrapper.promises._parseCouponXml(body)
  },

  async getBillingInfo(accountId) {
    const { body } = await RecurlyWrapper.promises.apiRequest({
      url: `accounts/${accountId}/billing_info`,
    })
    return await RecurlyWrapper.promises._parseXml(body)
  },

  async getAccountPastDueInvoices(accountId) {
    const { body } = await RecurlyWrapper.promises.apiRequest({
      url: `accounts/${accountId}/invoices`,
      qs: { state: 'past_due' },
    })
    return await RecurlyWrapper.promises._parseInvoicesXml(body)
  },

  async attemptInvoiceCollection(invoiceId) {
    return await RecurlyWrapper.promises.apiRequest({
      url: `invoices/${invoiceId}/collect`,
      method: 'PUT',
    })
  },

  async updateSubscription(subscriptionId, options) {
    logger.debug(
      { subscriptionId, options },
      'telling recurly to update subscription'
    )
    const data = {
      plan_code: options.plan_code,
      timeframe: options.timeframe,
    }
    let requestBody
    try {
      requestBody = RecurlyWrapper._buildXml('subscription', data)
    } catch (error) {
      throw OError.tag(error, 'error building xml', { subscriptionId })
    }

    const { body } = await RecurlyWrapper.promises.apiRequest({
      url: `subscriptions/${subscriptionId}`,
      method: 'PUT',
      body: requestBody,
    })
    return await RecurlyWrapper.promises._parseSubscriptionXml(body)
  },

  async createFixedAmountCoupon(
    couponCode,
    name,
    currencyCode,
    discountInCents,
    planCode
  ) {
    const data = {
      coupon_code: couponCode,
      name,
      discount_type: 'dollars',
      discount_in_cents: {},
      plan_codes: {
        plan_code: planCode,
      },
      applies_to_all_plans: false,
    }
    data.discount_in_cents[currencyCode] = discountInCents
    let requestBody
    try {
      requestBody = RecurlyWrapper._buildXml('coupon', data)
    } catch (error) {
      throw OError.tag(error, 'error building xml', {
        couponCode,
        name,
      })
    }

    logger.debug({ couponCode, requestBody }, 'creating coupon')
    try {
      await RecurlyWrapper.promises.apiRequest({
        url: 'coupons',
        method: 'POST',
        body: requestBody,
      })
    } catch (error) {
      logger.warn({ err: error, couponCode }, 'error creating coupon')
      throw error
    }
  },

  async lookupCoupon(couponCode) {
    const { body } = await RecurlyWrapper.promises.apiRequest({
      url: `coupons/${couponCode}`,
    })
    return await RecurlyWrapper.promises._parseCouponXml(body)
  },

  async redeemCoupon(accountCode, couponCode) {
    const data = {
      account_code: accountCode,
      currency: 'USD',
    }
    let requestBody
    try {
      requestBody = RecurlyWrapper._buildXml('redemption', data)
    } catch (error) {
      throw OError.tag(error, 'error building xml', {
        accountCode,
        couponCode,
      })
    }

    logger.debug(
      { accountCode, couponCode, requestBody },
      'redeeming coupon for user'
    )
    try {
      await RecurlyWrapper.promises.apiRequest({
        url: `coupons/${couponCode}/redeem`,
        method: 'POST',
        body: requestBody,
      })
    } catch (error) {
      logger.warn(
        { err: error, accountCode, couponCode },
        'error redeeming coupon'
      )
      throw error
    }
  },

  async extendTrial(subscriptionId, trialEndsAt, daysUntilExpire) {
    if (daysUntilExpire == null) {
      daysUntilExpire = 7
    }
    if (trialEndsAt == null) {
      trialEndsAt = new Date()
    }
    const nextRenewalDate = new Date(
      trialEndsAt.getTime() + daysUntilExpire * 24 * 60 * 60 * 1000
    )
    logger.debug(
      { subscriptionId, daysUntilExpire },
      'Extending Free trial for user'
    )
    try {
      await RecurlyWrapper.promises.apiRequest({
        url: `subscriptions/${subscriptionId}/postpone`,
        qs: { bulk: false, next_bill_date: nextRenewalDate },
        method: 'PUT',
      })
    } catch (error) {
      logger.warn(
        { err: error, subscriptionId, daysUntilExpire },
        'error extending trial'
      )
      throw error
    }
  },

  async listAccountActiveSubscriptions(accountId) {
    const { response, body } = await RecurlyWrapper.promises.apiRequest({
      url: `accounts/${accountId}/subscriptions`,
      qs: {
        state: 'active',
      },
      expect404: true,
    })
    if (response.status === 404) {
      return []
    } else {
      return await RecurlyWrapper.promises._parseSubscriptionsXml(body)
    }
  },

  async _handle422Response(body) {
    const data = await RecurlyWrapper.promises._parseErrorsXml(body)
    let errorData = {}
    if (data.transaction_error) {
      errorData = {
        message: data.transaction_error.merchant_message,
        info: {
          category: data.transaction_error.error_category,
          gatewayCode: data.transaction_error.gateway_error_code,
          public: {
            code: data.transaction_error.error_code,
            message: data.transaction_error.customer_message,
          },
        },
      }
      if (data.transaction_error.three_d_secure_action_token_id) {
        errorData.info.public.threeDSecureActionTokenId =
          data.transaction_error.three_d_secure_action_token_id
      }
    } else if (data.error && data.error._) {
      // fallback for errors that don't have a `transaction_error` field, but
      // instead a `error` field with a message (e.g. VATMOSS errors)
      errorData = {
        info: {
          public: {
            message: data.error._,
          },
        },
      }
    }
    throw new SubscriptionErrors.RecurlyTransactionError(errorData)
  },

  async _parseSubscriptionsXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(
      xml,
      'subscriptions'
    )
  },
  async _parseSubscriptionXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(
      xml,
      'subscription'
    )
  },
  async _parseAccountXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(
      xml,
      'account'
    )
  },
  async _parseBillingInfoXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(
      xml,
      'billing_info'
    )
  },
  async _parseRedemptionsXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(
      xml,
      'redemptions'
    )
  },
  async _parseCouponXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(xml, 'coupon')
  },
  async _parseErrorsXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(xml, 'errors')
  },
  async _parseInvoicesXml(xml) {
    return await RecurlyWrapper.promises._parseXmlAndGetAttribute(
      xml,
      'invoices'
    )
  },

  async _parseXmlAndGetAttribute(xml, attribute) {
    const data = await RecurlyWrapper.promises._parseXml(xml)
    if (data && data[attribute] != null) {
      return data[attribute]
    } else {
      throw new Error("I don't understand the response from Recurly")
    }
  },

  /**
   * @param xml
   */
  _parseXml(xml) {
    function convertDataTypes(data) {
      let key, value
      if (data && data.$) {
        if (data.$.nil === 'nil') {
          data = null
        } else if (data.$.href) {
          data.url = data.$.href
          delete data.$
        } else if (data.$.type === 'integer') {
          data = parseInt(data._, 10)
        } else if (data.$.type === 'datetime') {
          data = new Date(data._)
        } else if (data.$.type === 'array') {
          delete data.$
          let array = []
          for (key in data) {
            value = data[key]
            if (value instanceof Array) {
              array = array.concat(convertDataTypes(value))
            } else {
              array.push(convertDataTypes(value))
            }
          }
          data = array
        }
      }

      if (data instanceof Array) {
        data = data.map(entry => convertDataTypes(entry))
      } else if (typeof data === 'object') {
        for (key in data) {
          value = data[key]
          data[key] = convertDataTypes(value)
        }
      }
      return data
    }

    const parser = new xml2js.Parser({
      explicitRoot: true,
      explicitArray: false,
      emptyTag: '',
    })
    return new Promise((resolve, reject) =>
      parser.parseString(xml, function (error, data) {
        if (error) {
          return reject(error)
        }
        const result = convertDataTypes(data)
        resolve(result)
      })
    )
  },
}

function _buildXml(rootName, data) {
  const options = {
    headless: true,
    renderOpts: {
      pretty: true,
      indent: '\t',
    },
    rootName,
  }
  const builder = new xml2js.Builder(options)
  return builder.buildObject(data)
}

const RecurlyWrapper = {
  apiUrl: Settings.apis.recurly.url || 'https://api.recurly.com/v2',
  _buildXml,
  _parseXml: callbackify(promises._parseXml),
  createFixedAmountCoupon: callbackify(promises.createFixedAmountCoupon),
  getBillingInfo: callbackify(promises.getBillingInfo),
  getPaginatedEndpoint: callbackify(promises.getPaginatedEndpoint),
  getSubscription: callbackify(promises.getSubscription),
  getSubscriptions: callbackify(promises.getSubscriptions),
  updateAccountEmailAddress: callbackify(promises.updateAccountEmailAddress),
}

RecurlyWrapper.promises = {
  ...promises,
  updateAccountEmailAddress,
}

export default RecurlyWrapper

function getCustomFieldsFromSubscriptionDetails(subscriptionDetails) {
  if (!subscriptionDetails.ITMCampaign) {
    return null
  }

  const customFields = [
    {
      name: 'itm_campaign',
      value: subscriptionDetails.ITMCampaign,
    },
  ]
  if (subscriptionDetails.ITMContent) {
    customFields.push({
      name: 'itm_content',
      value: subscriptionDetails.ITMContent,
    })
  }
  if (subscriptionDetails.ITMReferrer) {
    customFields.push({
      name: 'itm_referrer',
      value: subscriptionDetails.ITMReferrer,
    })
  }
  return { custom_field: customFields }
}

function getAddressFromSubscriptionDetails(
  subscriptionDetails,
  includeCompanyInfo
) {
  const { address } = subscriptionDetails

  if (!address || !address.country) {
    throw new Errors.InvalidError({
      message: 'Invalid country',
      info: {
        public: {
          message: 'Invalid country',
        },
      },
    })
  }

  const addressObject = {
    address1: address.address1,
    address2: address.address2 || '',
    city: address.city || '',
    state: address.state || '',
    zip: address.zip || '',
    country: address.country,
  }

  if (
    includeCompanyInfo &&
    subscriptionDetails.billing_info &&
    subscriptionDetails.billing_info.company &&
    subscriptionDetails.billing_info.company !== ''
  ) {
    addressObject.company = subscriptionDetails.billing_info.company
    if (
      subscriptionDetails.billing_info.vat_number &&
      subscriptionDetails.billing_info.vat_number !== ''
    ) {
      addressObject.vat_number = subscriptionDetails.billing_info.vat_number
    }
  }

  return addressObject
}
