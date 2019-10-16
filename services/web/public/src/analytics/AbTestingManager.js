/* eslint-disable
    camelcase,
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'crypto-js/md5'], function(App, CryptoJS) {
  const oldKeys = [
    'sl_abt_multi_currency_editor_eu-eu',
    'sl_abt_multi_currency_eu-eu',
    'sl_abt_multi_currency_editor_eu-usd',
    'sl_abt_multi_currency_eu-usd',
    'sl_abt_trial_len_14d',
    'sl_abt_trial_len_7d',
    'sl_abt_trial_len_30d',
    'sl_utt',
    'sl_utt_trial_len',
    'sl_utt_multi_currency'
  ]

  App.factory('abTestManager', function($http, ipCookie) {
    let getABTestBucket, processTestWithStep
    _.each(oldKeys, oldKey => ipCookie.remove(oldKey))

    const _buildCookieKey = function(testName, bucket) {
      const key = `sl_abt_${testName}_${bucket}`
      return key
    }

    const _getTestCookie = function(testName, bucket) {
      const cookieKey = _buildCookieKey(testName, bucket)
      const cookie = ipCookie(cookieKey)
      return cookie
    }

    const _persistCookieStep = function(testName, bucket, newStep) {
      const cookieKey = _buildCookieKey(testName, bucket)
      ipCookie(cookieKey, { step: newStep }, { expires: 100, path: '/' })
      return ga(
        'send',
        'event',
        'ab_tests',
        `${testName}:${bucket}`,
        `step-${newStep}`
      )
    }

    const _checkIfStepIsNext = function(cookieStep, newStep) {
      if (cookieStep == null && newStep !== 0) {
        return false
      } else if (newStep === 0) {
        return true
      } else if (cookieStep + 1 === newStep) {
        return true
      } else {
        return false
      }
    }

    const _getUsersHash = function(testName) {
      const sl_user_test_token = `sl_utt_${testName}`
      let user_uuid = ipCookie(sl_user_test_token)
      if (user_uuid == null) {
        user_uuid = Math.random()
        ipCookie(sl_user_test_token, user_uuid, { expires: 365, path: '/' })
      }
      const hash = CryptoJS(`${user_uuid}:${testName}`)
      return hash
    }

    return {
      processTestWithStep: (processTestWithStep = function(
        testName,
        bucket,
        newStep
      ) {
        const currentCookieStep = __guard__(
          _getTestCookie(testName, bucket),
          x => x.step
        )
        if (_checkIfStepIsNext(currentCookieStep, newStep)) {
          return _persistCookieStep(testName, bucket, newStep)
        }
      }),

      getABTestBucket: (getABTestBucket = function(test_name, buckets) {
        const hash = _getUsersHash(test_name)
        const bucketIndex =
          parseInt(hash.toString().slice(0, 2), 16) %
          ((buckets != null ? buckets.length : undefined) || 2)
        return buckets[bucketIndex]
      })
    }
  })

  return App.controller('AbTestController', function($scope, abTestManager) {
    const testKeys = _.keys(window.ab)

    return _.each(window.ab, event =>
      abTestManager.processTestWithStep(
        event.testName,
        event.bucket,
        event.step
      )
    )
  })
})
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
