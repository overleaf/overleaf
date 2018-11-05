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
define(['base'], function(App) {
  App.controller(
    'SystemMessagesController',
    $scope => ($scope.messages = window.systemMessages)
  )

  return App.controller('SystemMessageController', function($scope, $sce) {
    $scope.hidden = $.localStorage(`systemMessage.hide.${$scope.message._id}`)
    $scope.htmlContent = $scope.message.content

    return ($scope.hide = function() {
      $scope.hidden = true
      return $.localStorage(`systemMessage.hide.${$scope.message._id}`, true)
    })
  })
})
