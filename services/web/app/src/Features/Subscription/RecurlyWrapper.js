const OError = require('@overleaf/o-error')
const request = require('request')
const Settings = require('@overleaf/settings')
const xml2js = require('xml2js')
const logger = require('@overleaf/logger')
const Async = require('async')
const Errors = require('../Errors/Errors')
const SubscriptionErrors = require('./Errors')
const { promisify } = require('util')

function updateAccountEmailAddress(accountId, newEmail, callback) {
  const data = {
    email: newEmail,
  }
  let requestBody
  try {
    requestBody = RecurlyWrapper._buildXml('account', data)
  } catch (error) {
    return callback(
      OError.tag(error, 'error building xml', { accountId, newEmail })
    )
  }

  RecurlyWrapper.apiRequest(
    {
      url: `accounts/${accountId}`,
      method: 'PUT',
      body: requestBody,
    },
    (error, response, body) => {
      if (error) {
        return callback(error)
      }
      RecurlyWrapper._parseAccountXml(body, callback)
    }
  )
}

const RecurlyWrapper = {
  apiUrl: Settings.apis.recurly.url || 'https://api.recurly.com/v2',

  _paypal: {
    checkAccountExists(cache, next) {
      const { user } = cache
      logger.debug(
        { userId: user._id },
        'checking if recurly account exists for user'
      )
      RecurlyWrapper.apiRequest(
        {
          url: `accounts/${user._id}`,
          method: 'GET',
          expect404: true,
        },
        function (error, response, responseBody) {
          if (error) {
            OError.tag(
              error,
              'error response from recurly while checking account',
              {
                user_id: user._id,
              }
            )
            return next(error)
          }
          if (response.statusCode === 404) {
            // actually not an error in this case, just no existing account
            logger.debug(
              { userId: user._id },
              'user does not currently exist in recurly, proceed'
            )
            cache.userExists = false
            return next(null, cache)
          }
          logger.debug({ userId: user._id }, 'user appears to exist in recurly')
          RecurlyWrapper._parseAccountXml(
            responseBody,
            function (err, account) {
              if (err) {
                OError.tag(err, 'error parsing account', {
                  user_id: user._id,
                })
                return next(err)
              }
              cache.userExists = true
              cache.account = account
              next(null, cache)
            }
          )
        }
      )
    },
    createAccount(cache, next) {
      const { user } = cache
      const { subscriptionDetails } = cache
      if (cache.userExists) {
        return next(null, cache)
      }

      let address
      try {
        address = getAddressFromSubscriptionDetails(subscriptionDetails, false)
      } catch (error) {
        return next(error)
      }
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
        return next(
          OError.tag(error, 'error building xml', { user_id: user._id })
        )
      }

      RecurlyWrapper.apiRequest(
        {
          url: 'accounts',
          method: 'POST',
          body: requestBody,
        },
        (error, response, responseBody) => {
          if (error) {
            OError.tag(
              error,
              'error response from recurly while creating account',
              {
                user_id: user._id,
              }
            )
            return next(error)
          }
          RecurlyWrapper._parseAccountXml(
            responseBody,
            function (err, account) {
              if (err) {
                OError.tag(err, 'error creating account', {
                  user_id: user._id,
                })
                return next(err)
              }
              cache.account = account
              next(null, cache)
            }
          )
        }
      )
    },
    createBillingInfo(cache, next) {
      const { user } = cache
      const { recurlyTokenIds } = cache
      logger.debug({ userId: user._id }, 'creating billing info in recurly')
      const accountCode = cache?.account?.account_code
      if (!accountCode) {
        return next(new Error('no account code at createBillingInfo stage'))
      }
      const data = { token_id: recurlyTokenIds.billing }
      let requestBody
      try {
        requestBody = RecurlyWrapper._buildXml('billing_info', data)
      } catch (error) {
        return next(
          OError.tag(error, 'error building xml', { user_id: user._id })
        )
      }
      RecurlyWrapper.apiRequest(
        {
          url: `accounts/${accountCode}/billing_info`,
          method: 'POST',
          body: requestBody,
        },
        (error, response, responseBody) => {
          if (error) {
            OError.tag(
              error,
              'error response from recurly while creating billing info',
              {
                user_id: user._id,
              }
            )
            return next(error)
          }
          RecurlyWrapper._parseBillingInfoXml(
            responseBody,
            function (err, billingInfo) {
              if (err) {
                OError.tag(err, 'error creating billing info', {
                  user_id: user._id,
                  accountCode,
                })
                return next(err)
              }
              cache.billingInfo = billingInfo
              next(null, cache)
            }
          )
        }
      )
    },

    setAddressAndCompanyBillingInfo(cache, next) {
      const { user } = cache
      const { subscriptionDetails } = cache
      logger.debug(
        { userId: user._id },
        'setting billing address and company info in recurly'
      )
      const accountCode = cache?.account?.account_code
      if (!accountCode) {
        return next(
          new Error('no account code at setAddressAndCompanyBillingInfo stage')
        )
      }

      let addressAndCompanyBillingInfo
      try {
        addressAndCompanyBillingInfo = getAddressFromSubscriptionDetails(
          subscriptionDetails,
          true
        )
      } catch (error) {
        return next(error)
      }

      let requestBody
      try {
        requestBody = RecurlyWrapper._buildXml(
          'billing_info',
          addressAndCompanyBillingInfo
        )
      } catch (error) {
        return next(
          OError.tag(error, 'error building xml', { user_id: user._id })
        )
      }

      RecurlyWrapper.apiRequest(
        {
          url: `accounts/${accountCode}/billing_info`,
          method: 'PUT',
          body: requestBody,
        },
        (error, response, responseBody) => {
          if (error) {
            OError.tag(
              error,
              'error response from recurly while setting address',
              {
                user_id: user._id,
              }
            )
            return next(error)
          }
          RecurlyWrapper._parseBillingInfoXml(
            responseBody,
            function (err, billingInfo) {
              if (err) {
                OError.tag(err, 'error updating billing info', {
                  user_id: user._id,
                })
                return next(err)
              }
              cache.billingInfo = billingInfo
              next(null, cache)
            }
          )
        }
      )
    },
    createSubscription(cache, next) {
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
      const customFields =
        getCustomFieldsFromSubscriptionDetails(subscriptionDetails)
      if (customFields) {
        data.custom_fields = customFields
      }
      let requestBody
      try {
        requestBody = RecurlyWrapper._buildXml('subscription', data)
      } catch (error) {
        return next(
          OError.tag(error, 'error building xml', { user_id: user._id })
        )
      }

      RecurlyWrapper.apiRequest(
        {
          url: 'subscriptions',
          method: 'POST',
          body: requestBody,
        },
        (error, response, responseBody) => {
          if (error) {
            OError.tag(
              error,
              'error response from recurly while creating subscription',
              {
                user_id: user._id,
              }
            )
            return next(error)
          }
          RecurlyWrapper._parseSubscriptionXml(
            responseBody,
            function (err, subscription) {
              if (err) {
                OError.tag(err, 'error creating subscription', {
                  user_id: user._id,
                })
                return next(err)
              }
              cache.subscription = subscription
              next(null, cache)
            }
          )
        }
      )
    },
  },

  _createPaypalSubscription(
    user,
    subscriptionDetails,
    recurlyTokenIds,
    callback
  ) {
    logger.debug(
      { userId: user._id },
      'starting process of creating paypal subscription'
    )
    // We use `async.waterfall` to run each of these actions in sequence
    // passing a `cache` object along the way. The cache is initialized
    // with required data, and `async.apply` to pass the cache to the first function
    const cache = { user, recurlyTokenIds, subscriptionDetails }
    Async.waterfall(
      [
        Async.apply(RecurlyWrapper._paypal.checkAccountExists, cache),
        RecurlyWrapper._paypal.createAccount,
        RecurlyWrapper._paypal.createBillingInfo,
        RecurlyWrapper._paypal.setAddressAndCompanyBillingInfo,
        RecurlyWrapper._paypal.createSubscription,
      ],
      function (err, result) {
        if (err) {
          OError.tag(err, 'error in paypal subscription creation process', {
            user_id: user._id,
          })
          return callback(err)
        }
        if (!result.subscription) {
          err = new Error('no subscription object in result')
          OError.tag(err, 'error in paypal subscription creation process', {
            user_id: user._id,
          })
          return callback(err)
        }
        logger.debug(
          { userId: user._id },
          'done creating paypal subscription for user'
        )
        callback(null, result.subscription)
      }
    )
  },

  _createCreditCardSubscription(
    user,
    subscriptionDetails,
    recurlyTokenIds,
    callback
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
    const customFields =
      getCustomFieldsFromSubscriptionDetails(subscriptionDetails)
    if (customFields) {
      data.custom_fields = customFields
    }
    let requestBody
    try {
      requestBody = RecurlyWrapper._buildXml('subscription', data)
    } catch (error) {
      return callback(
        OError.tag(error, 'error building xml', { user_id: user._id })
      )
    }

    RecurlyWrapper.apiRequest(
      {
        url: 'subscriptions',
        method: 'POST',
        body: requestBody,
        expect422: true,
      },
      (error, response, responseBody) => {
        if (error) {
          return callback(error)
        }

        if (response.statusCode === 422) {
          RecurlyWrapper._handle422Response(responseBody, callback)
        } else {
          RecurlyWrapper._parseSubscriptionXml(responseBody, callback)
        }
      }
    )
  },

  createSubscription(user, subscriptionDetails, recurlyTokenIds, callback) {
    const { isPaypal } = subscriptionDetails
    logger.debug(
      { userId: user._id, isPaypal },
      'setting up subscription in recurly'
    )
    const fn = isPaypal
      ? RecurlyWrapper._createPaypalSubscription
      : RecurlyWrapper._createCreditCardSubscription
    return fn(user, subscriptionDetails, recurlyTokenIds, callback)
  },

  apiRequest(options, callback) {
    options.url = RecurlyWrapper.apiUrl + '/' + options.url
    options.headers = {
      Authorization: `Basic ${Buffer.from(
        Settings.apis.recurly.apiKey
      ).toString('base64')}`,
      Accept: 'application/xml',
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Api-Version': Settings.apis.recurly.apiVersion,
    }
    const { expect404, expect422 } = options
    delete options.expect404
    delete options.expect422
    request(options, function (error, response, body) {
      if (
        !error &&
        response.statusCode !== 200 &&
        response.statusCode !== 201 &&
        response.statusCode !== 204 &&
        (response.statusCode !== 404 || !expect404) &&
        (response.statusCode !== 422 || !expect422)
      ) {
        logger.warn(
          {
            err: error,
            body,
            options,
            statusCode: response ? response.statusCode : undefined,
          },
          'error returned from recurly'
        )
        error = new OError(
          `Recurly API returned with status code: ${response.statusCode}`,
          { statusCode: response.statusCode }
        )
      }
      callback(error, response, body)
    })
  },

  getSubscriptions(accountId, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/subscriptions`,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseXml(body, callback)
      }
    )
  },

  getSubscription(subscriptionId, options, callback) {
    let url
    if (!callback) {
      callback = options
    }
    if (!options) {
      options = {}
    }

    if (options.recurlyJsResult) {
      url = `recurly_js/result/${subscriptionId}`
    } else {
      url = `subscriptions/${subscriptionId}`
    }

    RecurlyWrapper.apiRequest(
      {
        url,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseSubscriptionXml(
          body,
          (error, recurlySubscription) => {
            if (error) {
              return callback(error)
            }
            if (options.includeAccount) {
              let accountId
              if (
                recurlySubscription.account &&
                recurlySubscription.account.url
              ) {
                accountId =
                  recurlySubscription.account.url.match(/accounts\/(.*)/)[1]
              } else {
                return callback(
                  new Error("I don't understand the response from Recurly")
                )
              }

              RecurlyWrapper.getAccount(accountId, function (error, account) {
                if (error) {
                  return callback(error)
                }
                recurlySubscription.account = account
                callback(null, recurlySubscription)
              })
            } else {
              callback(null, recurlySubscription)
            }
          }
        )
      }
    )
  },

  getPaginatedEndpoint(resource, queryParams, callback) {
    queryParams.per_page = queryParams.per_page || 200
    let allItems = []
    const getPage = (cursor = null) => {
      const opts = {
        url: resource,
        qs: queryParams,
      }
      if (cursor) {
        opts.qs.cursor = cursor
      }
      return RecurlyWrapper.apiRequest(opts, (error, response, body) => {
        if (error) {
          return callback(error)
        }
        return RecurlyWrapper._parseXml(body, function (err, data) {
          if (err) {
            logger.warn({ err }, 'could not get accoutns')
            return callback(err)
          }
          const items = data[resource]
          allItems = allItems.concat(items)
          logger.debug(
            `got another ${items.length}, total now ${allItems.length}`
          )
          const match = response.headers.link?.match(
            /cursor=([0-9.]+%3A[0-9.]+)&/
          )
          cursor = match && match[1]
          if (cursor) {
            cursor = decodeURIComponent(cursor)
            return getPage(cursor)
          } else {
            callback(err, allItems)
          }
        })
      })
    }

    getPage()
  },

  getAccount(accountId, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}`,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseAccountXml(body, callback)
      }
    )
  },

  updateAccountEmailAddress,

  getAccountActiveCoupons(accountId, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/redemptions`,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseRedemptionsXml(
          body,
          function (error, redemptions) {
            if (error) {
              return callback(error)
            }
            const activeRedemptions = redemptions.filter(
              redemption => redemption.state === 'active'
            )
            const couponCodes = activeRedemptions.map(
              redemption => redemption.coupon_code
            )
            Async.map(
              couponCodes,
              RecurlyWrapper.getCoupon,
              function (error, coupons) {
                if (error) {
                  return callback(error)
                }
                return callback(null, coupons)
              }
            )
          }
        )
      }
    )
  },

  getCoupon(couponCode, callback) {
    const opts = { url: `coupons/${couponCode}` }
    RecurlyWrapper.apiRequest(opts, (error, response, body) => {
      if (error) {
        return callback(error)
      }
      RecurlyWrapper._parseCouponXml(body, callback)
    })
  },

  getBillingInfo(accountId, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/billing_info`,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseXml(body, callback)
      }
    )
  },

  getAccountPastDueInvoices(accountId, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/invoices?state=past_due`,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseInvoicesXml(body, callback)
      }
    )
  },

  attemptInvoiceCollection(invoiceId, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `invoices/${invoiceId}/collect`,
        method: 'put',
      },
      callback
    )
  },

  updateSubscription(subscriptionId, options, callback) {
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
      return callback(
        OError.tag(error, 'error building xml', { subscriptionId })
      )
    }

    RecurlyWrapper.apiRequest(
      {
        url: `subscriptions/${subscriptionId}`,
        method: 'put',
        body: requestBody,
      },
      (error, response, responseBody) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseSubscriptionXml(responseBody, callback)
      }
    )
  },

  createFixedAmmountCoupon(
    couponCode,
    name,
    currencyCode,
    discountInCents,
    planCode,
    callback
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
      return callback(
        OError.tag(error, 'error building xml', {
          couponCode,
          name,
        })
      )
    }

    logger.debug({ couponCode, requestBody }, 'creating coupon')
    RecurlyWrapper.apiRequest(
      {
        url: 'coupons',
        method: 'post',
        body: requestBody,
      },
      (error, response, responseBody) => {
        if (error) {
          logger.warn({ err: error, couponCode }, 'error creating coupon')
        }
        callback(error)
      }
    )
  },

  lookupCoupon(couponCode, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `coupons/${couponCode}`,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        RecurlyWrapper._parseXml(body, callback)
      }
    )
  },

  redeemCoupon(accountCode, couponCode, callback) {
    const data = {
      account_code: accountCode,
      currency: 'USD',
    }
    let requestBody
    try {
      requestBody = RecurlyWrapper._buildXml('redemption', data)
    } catch (error) {
      return callback(
        OError.tag(error, 'error building xml', {
          accountCode,
          couponCode,
        })
      )
    }

    logger.debug(
      { accountCode, couponCode, requestBody },
      'redeeming coupon for user'
    )
    RecurlyWrapper.apiRequest(
      {
        url: `coupons/${couponCode}/redeem`,
        method: 'post',
        body: requestBody,
      },
      (error, response, responseBody) => {
        if (error) {
          logger.warn(
            { err: error, accountCode, couponCode },
            'error redeeming coupon'
          )
        }
        callback(error)
      }
    )
  },

  extendTrial(subscriptionId, daysUntilExpire, callback) {
    if (daysUntilExpire == null) {
      daysUntilExpire = 7
    }
    const nextRenewalDate = new Date()
    nextRenewalDate.setDate(nextRenewalDate.getDate() + daysUntilExpire)
    logger.debug(
      { subscriptionId, daysUntilExpire },
      'Exending Free trial for user'
    )
    RecurlyWrapper.apiRequest(
      {
        url: `/subscriptions/${subscriptionId}/postpone?next_bill_date=${nextRenewalDate}&bulk=false`,
        method: 'put',
      },
      (error, response, responseBody) => {
        if (error) {
          logger.warn(
            { err: error, subscriptionId, daysUntilExpire },
            'error exending trial'
          )
        }
        callback(error)
      }
    )
  },

  listAccountActiveSubscriptions(accountId, callback) {
    RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/subscriptions`,
        qs: {
          state: 'active',
        },
        expect404: true,
      },
      function (error, response, body) {
        if (error) {
          return callback(error)
        }
        if (response.statusCode === 404) {
          callback(null, [])
        } else {
          RecurlyWrapper._parseSubscriptionsXml(body, callback)
        }
      }
    )
  },

  _handle422Response(body, callback) {
    RecurlyWrapper._parseErrorsXml(body, (error, data) => {
      if (error) {
        return callback(error)
      }

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
      callback(new SubscriptionErrors.RecurlyTransactionError(errorData))
    })
  },
  _parseSubscriptionsXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'subscriptions', callback)
  },

  _parseSubscriptionXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'subscription', callback)
  },

  _parseAccountXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'account', callback)
  },

  _parseBillingInfoXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'billing_info', callback)
  },

  _parseRedemptionsXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'redemptions', callback)
  },

  _parseCouponXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'coupon', callback)
  },

  _parseErrorsXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'errors', callback)
  },

  _parseInvoicesXml(xml, callback) {
    RecurlyWrapper._parseXmlAndGetAttribute(xml, 'invoices', callback)
  },

  _parseXmlAndGetAttribute(xml, attribute, callback) {
    RecurlyWrapper._parseXml(xml, function (error, data) {
      if (error) {
        return callback(error)
      }
      if (data && data[attribute] != null) {
        callback(null, data[attribute])
      } else {
        callback(new Error("I don't understand the response from Recurly"))
      }
    })
  },

  _parseXml(xml, callback) {
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
    parser.parseString(xml, function (error, data) {
      if (error) {
        return callback(error)
      }
      const result = convertDataTypes(data)
      callback(null, result)
    })
  },

  _buildXml(rootName, data) {
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
  },
}

RecurlyWrapper.promises = {
  getSubscription: promisify(RecurlyWrapper.getSubscription),
  updateAccountEmailAddress: promisify(updateAccountEmailAddress),
}

module.exports = RecurlyWrapper

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
