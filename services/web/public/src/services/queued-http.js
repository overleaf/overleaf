/* eslint-disable
    max-len,
    no-undef,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.factory('queuedHttp', function($http, $q) {
    const pendingRequests = []
    let inflight = false

    var processPendingRequests = function() {
      if (inflight) {
        return
      }
      const doRequest = pendingRequests.shift()
      if (doRequest != null) {
        inflight = true
        return doRequest()
          .then(function() {
            inflight = false
            return processPendingRequests()
          })
          .catch(function() {
            inflight = false
            return processPendingRequests()
          })
      }
    }

    const queuedHttp = function(...args) {
      // We can't use Angular's $q.defer promises, because it only passes
      // a single argument on error, and $http passes multiple.
      const promise = {}
      const successCallbacks = []
      const errorCallbacks = []

      // Adhere to the $http promise conventions
      promise.then = function(callback, errCallback) {
        successCallbacks.push(callback)
        if (errCallback != null) {
          errorCallbacks.push(errCallback)
        }
        return promise
      }

      promise.catch = function(callback) {
        errorCallbacks.push(callback)
        return promise
      }

      const doRequest = () =>
        $http(...Array.from(args || []))
          .then((...args) =>
            Array.from(successCallbacks).map(cb =>
              cb(...Array.from(args || []))
            )
          )
          .catch((...args) =>
            Array.from(errorCallbacks).map(cb => cb(...Array.from(args || [])))
          )

      pendingRequests.push(doRequest)
      processPendingRequests()

      return promise
    }

    queuedHttp.post = (url, data) => queuedHttp({ method: 'POST', url, data })

    return queuedHttp
  }))
