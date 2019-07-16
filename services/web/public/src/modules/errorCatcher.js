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
const app = angular.module('ErrorCatcher', [])
const UNHANDLED_REJECTION_ERR_MSG = 'Possibly unhandled rejection: canceled'

app.config([
  '$provide',
  $provide =>
    $provide.decorator('$exceptionHandler', [
      '$log',
      '$delegate',
      ($log, $delegate) =>
        function(exception, cause) {
          if (
            exception === UNHANDLED_REJECTION_ERR_MSG &&
            cause === undefined
          ) {
            return
          }
          if (
            (typeof Raven !== 'undefined' && Raven !== null
              ? Raven.captureException
              : undefined) != null
          ) {
            Raven.captureException(exception)
          }
          return $delegate(exception, cause)
        }
    ])
])

// Interceptor to check auth failures in all $http requests
// http://bahmutov.calepin.co/catch-all-errors-in-angular-app.html

app.factory('unAuthHttpResponseInterceptor', ($q, $location) => ({
  responseError(response) {
    // redirect any unauthorised or forbidden responses back to /login
    //
    // set disableAutoLoginRedirect:true in the http request config
    // to disable this behaviour
    if (
      [401, 403].includes(response.status) &&
      !(response.config != null
        ? response.config.disableAutoLoginRedirect
        : undefined)
    ) {
      // for /project urls set the ?redir parameter to come back here
      // otherwise just go to the login page
      if (window.location.pathname.match(/^\/project/)) {
        window.location = `/login?redir=${encodeURI(window.location.pathname)}`
      } else {
        window.location = '/login'
      }
    }
    // pass the response back to the original requester
    return $q.reject(response)
  }
}))

app.config([
  '$httpProvider',
  $httpProvider =>
    $httpProvider.interceptors.push('unAuthHttpResponseInterceptor')
])
