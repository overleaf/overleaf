/* eslint-disable
    max-len,
    no-return-assign,
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
import App from '../../base'
import EditorWatchdogManager from '../connection/EditorWatchdogManager'
import { debugConsole } from '@/utils/debugging'
// We create and provide this as service so that we can access the global ide
// from within other parts of the angular app.
App.factory('ide', [
  '$http',
  'queuedHttp',
  '$modal',
  '$q',
  '$filter',
  '$timeout',
  'eventTracking',
  function ($http, queuedHttp, $modal, $q, $filter, $timeout, eventTracking) {
    const ide = {}
    ide.$http = $http
    ide.queuedHttp = queuedHttp
    ide.$q = $q
    ide.$filter = $filter
    ide.$timeout = $timeout
    ide.globalEditorWatchdogManager = new EditorWatchdogManager({
      onTimeoutHandler: meta => {
        eventTracking.sendMB('losing-edits', meta)
        // clone the meta object, reportError adds additional fields into it
        ide.reportError('losing-edits', Object.assign({}, meta))
      },
    })

    this.recentEvents = []
    ide.pushEvent = (type, meta) => {
      if (meta == null) {
        meta = {}
      }
      debugConsole.log('event', type, meta)
      this.recentEvents.push({ type, meta, date: new Date() })
      if (this.recentEvents.length > 100) {
        return this.recentEvents.shift()
      }
    }

    ide.reportError = (error, meta) => {
      if (meta == null) {
        meta = {}
      }
      meta.user_id = window.user_id
      meta.project_id = window.project_id
      meta.client_id = __guard__(
        ide.socket != null ? ide.socket.socket : undefined,
        x => x.sessionid
      )
      meta.transport = __guard__(
        __guard__(
          ide.socket != null ? ide.socket.socket : undefined,
          x2 => x2.transport
        ),
        x1 => x1.name
      )
      meta.client_now = new Date()
      const errorObj = {}
      if (typeof error === 'object') {
        for (const key of Array.from(Object.getOwnPropertyNames(error))) {
          errorObj[key] = error[key]
        }
      } else if (typeof error === 'string') {
        errorObj.message = error
      }
      return $http.post('/error/client', {
        error: errorObj,
        meta,
        _csrf: window.csrfToken,
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
          },
        },
      })

    ide.showOutOfSyncModal = (title, message, editorContent) =>
      $modal.open({
        templateUrl: 'outOfSyncModalTemplate',
        controller: 'OutOfSyncModalController',
        backdrop: false, // not dismissable by clicking background
        keyboard: false, // prevent dismiss via keyboard
        resolve: {
          title() {
            return title
          },
          message() {
            return message
          },
          editorContent() {
            return editorContent
          },
        },
        windowClass: 'out-of-sync-modal',
      })

    ide.showLockEditorMessageModal = (title, message) =>
      // modal to block the editor when connection is down
      $modal.open({
        templateUrl: 'lockEditorModalTemplate',
        controller: 'GenericMessageModalController',
        backdrop: false, // not dismissable by clicking background
        keyboard: false, // prevent dismiss via keyboard
        resolve: {
          title() {
            return title
          },
          message() {
            return message
          },
        },
        windowClass: 'lock-editor-modal',
      })

    return ide
  },
])

App.controller('GenericMessageModalController', [
  '$scope',
  '$modalInstance',
  'title',
  'message',
  function ($scope, $modalInstance, title, message) {
    $scope.title = title
    $scope.message = message

    return ($scope.done = () => $modalInstance.close())
  },
])

App.controller('OutOfSyncModalController', [
  '$scope',
  '$window',
  'title',
  'message',
  'editorContent',
  function ($scope, $window, title, message, editorContent) {
    $scope.title = title
    $scope.message = message
    $scope.editorContent = editorContent
    $scope.editorContentRows = editorContent.split('\n').length

    $scope.done = () => {
      // Reload the page to avoid staying in an inconsistent state.
      // https://github.com/overleaf/issues/issues/3694
      $window.location.reload()
    }
  },
])

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
