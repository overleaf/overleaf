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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('OnlineUsersController', function($scope, ide) {
    $scope.gotoUser = function(user) {
      if (user.doc != null && user.row != null) {
        return ide.editorManager.openDoc(user.doc, { gotoLine: user.row + 1 })
      }
    }

    return ($scope.userInitial = function(user) {
      if (user.user_id === 'anonymous-user') {
        return '?'
      } else {
        return user.name.slice(0, 1)
      }
    })
  }))
