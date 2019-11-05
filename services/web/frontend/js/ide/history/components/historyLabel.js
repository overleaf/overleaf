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
define(['base'], function(App) {
  const historyLabelController = function(
    $scope,
    $element,
    $attrs,
    $filter,
    _
  ) {
    const ctrl = this
    ctrl.$onInit = () => {
      if (ctrl.showTooltip == null) {
        ctrl.showTooltip = true
      }
      if (ctrl.isPseudoCurrentStateLabel == null) {
        ctrl.isPseudoCurrentStateLabel = false
      }
    }
  }

  return App.component('historyLabel', {
    bindings: {
      labelText: '<',
      labelOwnerName: '<?',
      labelCreationDateTime: '<?',
      isOwnedByCurrentUser: '<',
      isPseudoCurrentStateLabel: '<',
      onLabelDelete: '&',
      showTooltip: '<?'
    },
    controller: historyLabelController,
    templateUrl: 'historyLabelTpl'
  })
})
