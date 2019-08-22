/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
    node/no-deprecated-api,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RecurlyWrapper
const querystring = require('querystring')
const crypto = require('crypto')
const request = require('request')
const Settings = require('settings-sharelatex')
const xml2js = require('xml2js')
const logger = require('logger-sharelatex')
const Async = require('async')
const SubscriptionErrors = require('./Errors')

module.exports = RecurlyWrapper = {
  apiUrl: Settings.apis.recurly.url || 'https://api.recurly.com/v2',

  _paypal: {
    checkAccountExists(cache, next) {
      const { user } = cache
      const { subscriptionDetails } = cache
      logger.log(
        { user_id: user._id },
        'checking if recurly account exists for user'
      )
      return RecurlyWrapper.apiRequest(
        {
          url: `accounts/${user._id}`,
          method: 'GET',
          expect404: true
        },
        function(error, response, responseBody) {
          if (error) {
            logger.warn(
              { error, user_id: user._id },
              'error response from recurly while checking account'
            )
            return next(error)
          }
          if (response.statusCode === 404) {
            // actually not an error in this case, just no existing account
            logger.log(
              { user_id: user._id },
              'user does not currently exist in recurly, proceed'
            )
            cache.userExists = false
            return next(null, cache)
          }
          logger.log({ user_id: user._id }, 'user appears to exist in recurly')
          return RecurlyWrapper._parseAccountXml(responseBody, function(
            err,
            account
          ) {
            if (err) {
              logger.warn({ err, user_id: user._id }, 'error parsing account')
              return next(err)
            }
            cache.userExists = true
            cache.account = account
            return next(null, cache)
          })
        }
      )
    },
    createAccount(cache, next) {
      const { user } = cache
      const { subscriptionDetails } = cache
      const { address } = subscriptionDetails
      if (!address) {
        return next(
          new Error('no address in subscriptionDetails at createAccount stage')
        )
      }
      if (cache.userExists) {
        logger.log({ user_id: user._id }, 'user already exists in recurly')
        return next(null, cache)
      }
      logger.log({ user_id: user._id }, 'creating user in recurly')
      const data = {
        account_code: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        address: {
          address1: address.address1,
          address2: address.address2 || '',
          city: address.city || '',
          state: address.state || '',
          zip: address.zip || '',
          country: address.country
        }
      }
      const requestBody = RecurlyWrapper._buildXml('account', data)

      return RecurlyWrapper.apiRequest(
        {
          url: 'accounts',
          method: 'POST',
          body: requestBody
        },
        (error, response, responseBody) => {
          if (error) {
            logger.warn(
              { error, user_id: user._id },
              'error response from recurly while creating account'
            )
            return next(error)
          }
          return RecurlyWrapper._parseAccountXml(responseBody, function(
            err,
            account
          ) {
            if (err) {
              logger.warn({ err, user_id: user._id }, 'error creating account')
              return next(err)
            }
            cache.account = account
            return next(null, cache)
          })
        }
      )
    },
    createBillingInfo(cache, next) {
      const { user } = cache
      const { recurlyTokenIds } = cache
      const { subscriptionDetails } = cache
      logger.log({ user_id: user._id }, 'creating billing info in recurly')
      const accountCode = __guard__(
        cache != null ? cache.account : undefined,
        x1 => x1.account_code
      )
      if (!accountCode) {
        return next(new Error('no account code at createBillingInfo stage'))
      }
      const data = { token_id: recurlyTokenIds.billing }
      const requestBody = RecurlyWrapper._buildXml('billing_info', data)
      return RecurlyWrapper.apiRequest(
        {
          url: `accounts/${accountCode}/billing_info`,
          method: 'POST',
          body: requestBody
        },
        (error, response, responseBody) => {
          if (error) {
            logger.warn(
              { error, user_id: user._id },
              'error response from recurly while creating billing info'
            )
            return next(error)
          }
          return RecurlyWrapper._parseBillingInfoXml(responseBody, function(
            err,
            billingInfo
          ) {
            if (err) {
              logger.warn(
                { err, user_id: user._id, accountCode },
                'error creating billing info'
              )
              return next(err)
            }
            cache.billingInfo = billingInfo
            return next(null, cache)
          })
        }
      )
    },

    setAddress(cache, next) {
      const { user } = cache
      const { subscriptionDetails } = cache
      logger.log({ user_id: user._id }, 'setting billing address in recurly')
      const accountCode = __guard__(
        cache != null ? cache.account : undefined,
        x1 => x1.account_code
      )
      if (!accountCode) {
        return next(new Error('no account code at setAddress stage'))
      }
      const { address } = subscriptionDetails
      if (!address) {
        return next(
          new Error('no address in subscriptionDetails at setAddress stage')
        )
      }
      const data = {
        address1: address.address1,
        address2: address.address2 || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.zip || '',
        country: address.country
      }
      const requestBody = RecurlyWrapper._buildXml('billing_info', data)

      return RecurlyWrapper.apiRequest(
        {
          url: `accounts/${accountCode}/billing_info`,
          method: 'PUT',
          body: requestBody
        },
        (error, response, responseBody) => {
          if (error) {
            logger.warn(
              { error, user_id: user._id },
              'error response from recurly while setting address'
            )
            return next(error)
          }
          return RecurlyWrapper._parseBillingInfoXml(responseBody, function(
            err,
            billingInfo
          ) {
            if (err) {
              logger.warn(
                { err, user_id: user._id },
                'error updating billing info'
              )
              return next(err)
            }
            cache.billingInfo = billingInfo
            return next(null, cache)
          })
        }
      )
    },
    createSubscription(cache, next) {
      const { user } = cache
      const { subscriptionDetails } = cache
      logger.log({ user_id: user._id }, 'creating subscription in recurly')
      const data = {
        plan_code: subscriptionDetails.plan_code,
        currency: subscriptionDetails.currencyCode,
        coupon_code: subscriptionDetails.coupon_code,
        account: {
          account_code: user._id
        }
      }
      const requestBody = RecurlyWrapper._buildXml('subscription', data)

      return RecurlyWrapper.apiRequest(
        {
          url: 'subscriptions',
          method: 'POST',
          body: requestBody
        },
        (error, response, responseBody) => {
          if (error) {
            logger.warn(
              { error, user_id: user._id },
              'error response from recurly while creating subscription'
            )
            return next(error)
          }
          return RecurlyWrapper._parseSubscriptionXml(responseBody, function(
            err,
            subscription
          ) {
            if (err) {
              logger.warn(
                { err, user_id: user._id },
                'error creating subscription'
              )
              return next(err)
            }
            cache.subscription = subscription
            return next(null, cache)
          })
        }
      )
    }
  },

  _createPaypalSubscription(
    user,
    subscriptionDetails,
    recurlyTokenIds,
    callback
  ) {
    logger.log(
      { user_id: user._id },
      'starting process of creating paypal subscription'
    )
    // We use `async.waterfall` to run each of these actions in sequence
    // passing a `cache` object along the way. The cache is initialized
    // with required data, and `async.apply` to pass the cache to the first function
    const cache = { user, recurlyTokenIds, subscriptionDetails }
    return Async.waterfall(
      [
        Async.apply(RecurlyWrapper._paypal.checkAccountExists, cache),
        RecurlyWrapper._paypal.createAccount,
        RecurlyWrapper._paypal.createBillingInfo,
        RecurlyWrapper._paypal.setAddress,
        RecurlyWrapper._paypal.createSubscription
      ],
      function(err, result) {
        if (err) {
          logger.warn(
            { err, user_id: user._id },
            'error in paypal subscription creation process'
          )
          return callback(err)
        }
        if (!result.subscription) {
          err = new Error('no subscription object in result')
          logger.warn(
            { err, user_id: user._id },
            'error in paypal subscription creation process'
          )
          return callback(err)
        }
        logger.log(
          { user_id: user._id },
          'done creating paypal subscription for user'
        )
        return callback(null, result.subscription)
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
          token_id: recurlyTokenIds.billing
        }
      }
    }
    if (recurlyTokenIds.threeDSecureActionResult) {
      data.account.billing_info.three_d_secure_action_result_token_id =
        recurlyTokenIds.threeDSecureActionResult
    }
    const requestBody = RecurlyWrapper._buildXml('subscription', data)

    return RecurlyWrapper.apiRequest(
      {
        url: 'subscriptions',
        method: 'POST',
        body: requestBody,
        expect422: true
      },
      (error, response, responseBody) => {
        if (error != null) {
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
    logger.log(
      { user_id: user._id, isPaypal },
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
      Authorization: `Basic ${new Buffer(Settings.apis.recurly.apiKey).toString(
        'base64'
      )}`,
      Accept: 'application/xml',
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Api-Version': Settings.apis.recurly.apiVersion
    }
    const { expect404, expect422 } = options
    delete options.expect404
    delete options.expect422
    return request(options, function(error, response, body) {
      if (
        error == null &&
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
            statusCode: response != null ? response.statusCode : undefined
          },
          'error returned from recurly'
        )
        error = `Recurly API returned with status code: ${response.statusCode}`
      }
      if (response.statusCode === 404 && expect404) {
        logger.log(
          { url: options.url, method: options.method },
          'got 404 response from recurly, expected as valid response'
        )
      }
      if (response.statusCode === 422 && expect422) {
        logger.log(
          { url: options.url, method: options.method },
          'got 422 response from recurly, expected as valid response'
        )
      }
      return callback(error, response, body)
    })
  },

  getSubscriptions(accountId, callback) {
    return RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/subscriptions`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseXml(body, callback)
      }
    )
  },

  getSubscription(subscriptionId, options, callback) {
    let url
    if (callback == null) {
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

    return RecurlyWrapper.apiRequest(
      {
        url
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseSubscriptionXml(
          body,
          (error, recurlySubscription) => {
            if (error != null) {
              return callback(error)
            }
            if (options.includeAccount) {
              let accountId
              if (
                recurlySubscription.account != null &&
                recurlySubscription.account.url != null
              ) {
                accountId = recurlySubscription.account.url.match(
                  /accounts\/(.*)/
                )[1]
              } else {
                return callback(
                  new Error("I don't understand the response from Recurly")
                )
              }

              return RecurlyWrapper.getAccount(accountId, function(
                error,
                account
              ) {
                if (error != null) {
                  return callback(error)
                }
                recurlySubscription.account = account
                return callback(null, recurlySubscription)
              })
            } else {
              return callback(null, recurlySubscription)
            }
          }
        )
      }
    )
  },

  getAccounts(callback) {
    let allAccounts = []
    var getPageOfAccounts = (cursor = null) => {
      const opts = {
        url: 'accounts',
        qs: {
          per_page: 200
        }
      }
      if (cursor != null) {
        opts.qs.cursor = cursor
      }
      return RecurlyWrapper.apiRequest(opts, (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseXml(body, function(err, data) {
          if (err != null) {
            logger.warn({ err }, 'could not get accoutns')
            callback(err)
          }
          allAccounts = allAccounts.concat(data.accounts)
          logger.log(
            `got another ${data.accounts.length}, total now ${
              allAccounts.length
            }`
          )
          cursor = __guard__(
            response.headers.link != null
              ? response.headers.link.match(/cursor=([0-9]+)&/)
              : undefined,
            x1 => x1[1]
          )
          if (cursor != null) {
            return getPageOfAccounts(cursor)
          } else {
            return callback(err, allAccounts)
          }
        })
      })
    }

    return getPageOfAccounts()
  },

  getAccount(accountId, callback) {
    return RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseAccountXml(body, callback)
      }
    )
  },

  getAccountActiveCoupons(accountId, callback) {
    return RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/redemptions`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseRedemptionsXml(body, function(
          error,
          redemptions
        ) {
          if (error != null) {
            return callback(error)
          }
          const activeRedemptions = redemptions.filter(
            redemption => redemption.state === 'active'
          )
          const couponCodes = activeRedemptions.map(
            redemption => redemption.coupon_code
          )
          return Async.map(couponCodes, RecurlyWrapper.getCoupon, function(
            error,
            coupons
          ) {
            if (error != null) {
              return callback(error)
            }
            return callback(null, coupons)
          })
        })
      }
    )
  },

  getCoupon(couponCode, callback) {
    const opts = { url: `coupons/${couponCode}` }
    return RecurlyWrapper.apiRequest(opts, (error, response, body) =>
      RecurlyWrapper._parseCouponXml(body, callback)
    )
  },

  getBillingInfo(accountId, callback) {
    return RecurlyWrapper.apiRequest(
      {
        url: `accounts/${accountId}/billing_info`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseXml(body, callback)
      }
    )
  },

  updateSubscription(subscriptionId, options, callback) {
    logger.log(
      { subscriptionId, options },
      'telling recurly to update subscription'
    )
    const data = {
      plan_code: options.plan_code,
      timeframe: options.timeframe
    }
    const requestBody = RecurlyWrapper._buildXml('subscription', data)

    return RecurlyWrapper.apiRequest(
      {
        url: `subscriptions/${subscriptionId}`,
        method: 'put',
        body: requestBody
      },
      (error, response, responseBody) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseSubscriptionXml(responseBody, callback)
      }
    )
  },

  createFixedAmmountCoupon(
    coupon_code,
    name,
    currencyCode,
    discount_in_cents,
    plan_code,
    callback
  ) {
    const data = {
      coupon_code,
      name,
      discount_type: 'dollars',
      discount_in_cents: {},
      plan_codes: {
        plan_code
      },
      applies_to_all_plans: false
    }
    data.discount_in_cents[currencyCode] = discount_in_cents
    const requestBody = RecurlyWrapper._buildXml('coupon', data)

    logger.log({ coupon_code, requestBody }, 'creating coupon')
    return RecurlyWrapper.apiRequest(
      {
        url: 'coupons',
        method: 'post',
        body: requestBody
      },
      (error, response, responseBody) => {
        if (error != null) {
          logger.warn({ err: error, coupon_code }, 'error creating coupon')
        }
        return callback(error)
      }
    )
  },

  lookupCoupon(coupon_code, callback) {
    return RecurlyWrapper.apiRequest(
      {
        url: `coupons/${coupon_code}`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return RecurlyWrapper._parseXml(body, callback)
      }
    )
  },

  cancelSubscription(subscriptionId, callback) {
    logger.log({ subscriptionId }, 'telling recurly to cancel subscription')
    return RecurlyWrapper.apiRequest(
      {
        url: `subscriptions/${subscriptionId}/cancel`,
        method: 'put'
      },
      function(error, response, body) {
        if (error != null) {
          return RecurlyWrapper._parseXml(body, function(_err, parsed) {
            if (
              __guard__(
                parsed != null ? parsed.error : undefined,
                x1 => x1.description
              ) === "A canceled subscription can't transition to canceled"
            ) {
              logger.log(
                { subscriptionId, error, body },
                'subscription already cancelled, not really an error, proceeding'
              )
              return callback(null)
            } else {
              return callback(error)
            }
          })
        } else {
          return callback(null)
        }
      }
    )
  },

  reactivateSubscription(subscriptionId, callback) {
    logger.log(
      { subscriptionId },
      'telling recurly to reactivating subscription'
    )
    return RecurlyWrapper.apiRequest(
      {
        url: `subscriptions/${subscriptionId}/reactivate`,
        method: 'put'
      },
      (error, response, body) => callback(error)
    )
  },

  redeemCoupon(account_code, coupon_code, callback) {
    const data = {
      account_code,
      currency: 'USD'
    }
    const requestBody = RecurlyWrapper._buildXml('redemption', data)

    logger.log(
      { account_code, coupon_code, requestBody },
      'redeeming coupon for user'
    )
    return RecurlyWrapper.apiRequest(
      {
        url: `coupons/${coupon_code}/redeem`,
        method: 'post',
        body: requestBody
      },
      (error, response, responseBody) => {
        if (error != null) {
          logger.warn(
            { err: error, account_code, coupon_code },
            'error redeeming coupon'
          )
        }
        return callback(error)
      }
    )
  },

  extendTrial(subscriptionId, daysUntilExpire, callback) {
    if (daysUntilExpire == null) {
      daysUntilExpire = 7
    }
    const next_renewal_date = new Date()
    next_renewal_date.setDate(next_renewal_date.getDate() + daysUntilExpire)
    logger.log(
      { subscriptionId, daysUntilExpire },
      'Exending Free trial for user'
    )
    return RecurlyWrapper.apiRequest(
      {
        url: `/subscriptions/${subscriptionId}/postpone?next_renewal_date=${next_renewal_date}&bulk=false`,
        method: 'put'
      },
      (error, response, responseBody) => {
        if (error != null) {
          logger.warn(
            { err: error, subscriptionId, daysUntilExpire },
            'error exending trial'
          )
        }
        return callback(error)
      }
    )
  },

  listAccountActiveSubscriptions(account_id, callback) {
    if (callback == null) {
      callback = function(error, subscriptions) {}
    }
    return RecurlyWrapper.apiRequest(
      {
        url: `accounts/${account_id}/subscriptions`,
        qs: {
          state: 'active'
        },
        expect404: true
      },
      function(error, response, body) {
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode === 404) {
          return callback(null, [])
        } else {
          return RecurlyWrapper._parseSubscriptionsXml(body, callback)
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
              message: data.transaction_error.customer_message
            }
          }
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
              message: data.error._
            }
          }
        }
      }
      callback(new SubscriptionErrors.RecurlyTransactionError(errorData))
    })
  },
  _parseSubscriptionsXml(xml, callback) {
    return RecurlyWrapper._parseXmlAndGetAttribute(
      xml,
      'subscriptions',
      callback
    )
  },

  _parseSubscriptionXml(xml, callback) {
    return RecurlyWrapper._parseXmlAndGetAttribute(
      xml,
      'subscription',
      callback
    )
  },

  _parseAccountXml(xml, callback) {
    return RecurlyWrapper._parseXmlAndGetAttribute(xml, 'account', callback)
  },

  _parseBillingInfoXml(xml, callback) {
    return RecurlyWrapper._parseXmlAndGetAttribute(
      xml,
      'billing_info',
      callback
    )
  },

  _parseRedemptionsXml(xml, callback) {
    return RecurlyWrapper._parseXmlAndGetAttribute(xml, 'redemptions', callback)
  },

  _parseCouponXml(xml, callback) {
    return RecurlyWrapper._parseXmlAndGetAttribute(xml, 'coupon', callback)
  },

  _parseErrorsXml(xml, callback) {
    return RecurlyWrapper._parseXmlAndGetAttribute(xml, 'errors', callback)
  },

  _parseXmlAndGetAttribute(xml, attribute, callback) {
    return RecurlyWrapper._parseXml(xml, function(error, data) {
      if (error != null) {
        return callback(error)
      }
      if (data != null && data[attribute] != null) {
        return callback(null, data[attribute])
      } else {
        return callback(
          new Error("I don't understand the response from Recurly")
        )
      }
    })
  },

  _parseXml(xml, callback) {
    var convertDataTypes = function(data) {
      let key, value
      if (data != null && data['$'] != null) {
        if (data['$']['nil'] === 'nil') {
          data = null
        } else if (data['$'].href != null) {
          data.url = data['$'].href
          delete data['$']
        } else if (data['$']['type'] === 'integer') {
          data = parseInt(data['_'], 10)
        } else if (data['$']['type'] === 'datetime') {
          data = new Date(data['_'])
        } else if (data['$']['type'] === 'array') {
          delete data['$']
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
        data = Array.from(data).map(entry => convertDataTypes(entry))
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
      emptyTag: ''
    })
    return parser.parseString(xml, function(error, data) {
      if (error != null) {
        return callback(error)
      }
      const result = convertDataTypes(data)
      return callback(null, result)
    })
  },

  _buildXml(rootName, data) {
    const options = {
      headless: true,
      renderOpts: {
        pretty: true,
        indent: '\t'
      },
      rootName
    }
    const builder = new xml2js.Builder(options)
    return builder.buildObject(data)
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
