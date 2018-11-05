/* eslint-disable
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
define(['base'], App =>
  App.controller('PdfViewToggleController', function($scope) {
    $scope.togglePdfView = function() {
      if ($scope.ui.view === 'pdf') {
        return ($scope.ui.view = 'editor')
      } else {
        return ($scope.ui.view = 'pdf')
      }
    }

    $scope.fileTreeClosed = false
    return $scope.$on('layout:main:resize', function(e, state) {
      if (state.west.initClosed) {
        $scope.fileTreeClosed = true
      } else {
        $scope.fileTreeClosed = false
      }
      return $scope.$apply()
    })
  }))
