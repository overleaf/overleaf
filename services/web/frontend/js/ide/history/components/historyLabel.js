/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../../base'
const historyLabelController = function ($scope, $element, $attrs, $filter) {
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

export default App.component('historyLabel', {
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
