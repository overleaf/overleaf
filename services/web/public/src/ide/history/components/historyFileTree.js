/* eslint-disable
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
  const historyFileTreeController = function($scope, $element, $attrs) {
    const ctrl = this
    ctrl.handleEntityClick = file => ctrl.onSelectedFileChange({ file })
  }

  return App.component('historyFileTree', {
    bindings: {
      fileTree: '<',
      selectedPathname: '<',
      onSelectedFileChange: '&',
      isLoading: '<'
    },
    controller: historyFileTreeController,
    templateUrl: 'historyFileTreeTpl'
  })
})
