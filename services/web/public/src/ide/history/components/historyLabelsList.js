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
define([
  'base',
  'ide/colors/ColorManager',
  'ide/history/util/displayNameForUser'
], function(App, ColorManager, displayNameForUser) {
  const historyLabelsListController = function($scope, $element, $attrs) {
    const ctrl = this
    // This method (and maybe the one below) will be removed soon. User details data will be
    // injected into the history API responses, so we won't need to fetch user data from other
    // local data structures.
    ctrl.getUserById = id =>
      _.find(ctrl.users, function(user) {
        const curUserId =
          (user != null ? user._id : undefined) ||
          (user != null ? user.id : undefined)
        return curUserId === id
      })
    ctrl.displayName = displayNameForUser
    ctrl.getUserCSSStyle = function(user, label) {
      const curUserId =
        (user != null ? user._id : undefined) ||
        (user != null ? user.id : undefined)
      const hue = ColorManager.getHueForUserId(curUserId) || 100
      if (
        label.id ===
        (ctrl.selectedLabel != null ? ctrl.selectedLabel.id : undefined)
      ) {
        return { color: '#FFF' }
      } else {
        return { color: `hsl(${hue}, 70%, 50%)` }
      }
    }
  }

  return App.component('historyLabelsList', {
    bindings: {
      labels: '<',
      users: '<',
      currentUser: '<',
      isLoading: '<',
      selectedLabel: '<',
      onLabelSelect: '&',
      onLabelDelete: '&'
    },
    controller: historyLabelsListController,
    templateUrl: 'historyLabelsListTpl'
  })
})
