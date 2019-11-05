/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
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
define(['base'], function(App) {
  // We create and provide this as service so that we can access the global ide
  // from within other parts of the angular app.
  App.factory('ide', function(
    $http,
    queuedHttp,
    $modal,
    $q,
    $filter,
    $timeout
  ) {
    const ide = {}
    ide.$http = $http
    ide.queuedHttp = queuedHttp
    ide.$q = $q
    ide.$filter = $filter
    ide.$timeout = $timeout

    this.recentEvents = []
    ide.pushEvent = (type, meta) => {
      if (meta == null) {
        meta = {}
      }
      sl_console.log('event', type, meta)
      this.recentEvents.push({ type, meta, date: new Date() })
      if (this.recentEvents.length > 100) {
        return this.recentEvents.shift()
      }
    }

    ide.reportError = (error, meta) => {
      if (meta == null) {
        meta = {}
      }
      meta.client_id = __guard__(
        this.socket != null ? this.socket.socket : undefined,
        x => x.sessionid
      )
      meta.transport = __guard__(
        __guard__(
          this.socket != null ? this.socket.socket : undefined,
          x2 => x2.transport
        ),
        x1 => x1.name
      )
      meta.client_now = new Date()
      meta.recent_events = this.recentEvents
      const errorObj = {}
      if (typeof error === 'object') {
        for (let key of Array.from(Object.getOwnPropertyNames(error))) {
          errorObj[key] = error[key]
        }
      } else if (typeof error === 'string') {
        errorObj.message = error
      }
      return $http.post('/error/client', {
        error: errorObj,
        meta,
        _csrf: window.csrfToken
      })
    }

    ide.showGenericMessageModal = (title, message) =>
      $modal.open({
        templateUrl: 'genericMessageModalTemplate',
        controller: 'GenericMessageModalController',
        resolve: {
          title() {
            return title
          },
          message() {
            return message
          }
        }
      })

    ide.showLockEditorMessageModal = (title, message) =>
      // modal to block the editor when connection is down
      $modal.open({
        templateUrl: 'lockEditorModalTemplate',
        controller: 'GenericMessageModalController',
        backdrop: 'static', // prevent dismiss by click on background
        keyboard: false, // prevent dismiss via keyboard
        resolve: {
          title() {
            return title
          },
          message() {
            return message
          }
        },
        windowClass: 'lock-editor-modal'
      })

    return ide
  })

  return App.controller('GenericMessageModalController', function(
    $scope,
    $modalInstance,
    title,
    message
  ) {
    $scope.title = title
    $scope.message = message

    return ($scope.done = () => $modalInstance.close())
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
