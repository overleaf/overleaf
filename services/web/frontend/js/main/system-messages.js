/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['../base'], function(App) {
  const MESSAGE_POLL_INTERVAL = 15 * 60 * 1000
  // Controller for messages (array)
  App.controller('SystemMessagesController', ($http, $scope) => {
    $scope.messages = window.systemMessages
    var pollSystemMessages = function() {
      $http
        .get('/system/messages')
        .then(response => {
          $scope.messages = response.data
        })
        .catch(() => {
          // ignore errors
        })
    }
    pollSystemMessages()
    setInterval(pollSystemMessages, MESSAGE_POLL_INTERVAL)
  })

  // Controller for individual message  (show/hide)
  return App.controller('SystemMessageController', function($scope, $sce) {
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
})
