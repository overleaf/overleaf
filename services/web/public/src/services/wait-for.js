/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.factory('waitFor', function($q) {
    const waitFor = function(testFunction, timeout, pollInterval) {
      if (pollInterval == null) {
        pollInterval = 500
      }
      const iterationLimit = Math.floor(timeout / pollInterval)
      let iterations = 0
      return $q(function(resolve, reject) {
        let tryIteration
        return (tryIteration = function() {
          if (iterations > iterationLimit) {
            return reject(
              new Error(
                `waiting too long, ${JSON.stringify({ timeout, pollInterval })}`
              )
            )
          }
          iterations += 1
          const result = testFunction()
          if (result != null) {
            return resolve(result)
          } else {
            return setTimeout(tryIteration, pollInterval)
          }
        })()
      })
    }
    return waitFor
  }))
