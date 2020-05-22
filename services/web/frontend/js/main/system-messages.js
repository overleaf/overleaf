/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../base'
const MESSAGE_POLL_INTERVAL = 15 * 60 * 1000
// Controller for messages (array)
App.controller('SystemMessagesController', ($http, $scope) => {
  $scope.messages = []
  var pollSystemMessages = function() {
    // Ignore polling if tab is hidden or browser is offline
    if (document.hidden || !navigator.onLine) {
      return
    }

    $http
      .get('/system/messages')
      .then(response => {
        // Ignore if content-type is anything but JSON, prevents a bug where
        // the user logs out in another tab, then a 302 redirect was returned,
        // which is transparently resolved by the browser to the login (HTML)
        // page.
        // This then caused an Angular error where it was attempting to loop
        // through the HTML as a string
        if (response.headers('content-type').includes('json')) {
          $scope.messages = response.data
        }
      })
      .catch(() => {
        // ignore errors
      })
  }
  pollSystemMessages()
  setInterval(pollSystemMessages, MESSAGE_POLL_INTERVAL)
})

export default App.controller('SystemMessageController', function(
  $scope,
  $sce
) {
  $scope.hidden = $.localStorage(`systemMessage.hide.${$scope.message._id}`)
  $scope.protected = $scope.message._id === 'protected'
  $scope.htmlContent = $scope.message.content

  return ($scope.hide = function() {
    if (!$scope.protected) {
      // do not allow protected messages to be hidden
      $scope.hidden = true
      return $.localStorage(`systemMessage.hide.${$scope.message._id}`, true)
    }
  })
})
