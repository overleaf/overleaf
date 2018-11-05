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
define(['base'], function(App) {
  App.directive('selectAllList', () => ({
    controller: [
      '$scope',
      function($scope) {
        // Selecting or deselecting all should apply to all projects
        this.selectAll = () => $scope.$broadcast('select-all:select')

        this.deselectAll = () => $scope.$broadcast('select-all:deselect')

        this.clearSelectAllState = () => $scope.$broadcast('select-all:clear')
      }
    ],
    link(scope, element, attrs) {}
  }))

  App.directive('selectAll', () => ({
    require: '^selectAllList',
    link(scope, element, attrs, selectAllListController) {
      scope.$on('select-all:clear', () => element.prop('checked', false))

      return element.change(function() {
        if (element.is(':checked')) {
          selectAllListController.selectAll()
        } else {
          selectAllListController.deselectAll()
        }
        return true
      })
    }
  }))

  App.directive('selectIndividual', () => ({
    require: '^selectAllList',
    scope: {
      ngModel: '='
    },
    link(scope, element, attrs, selectAllListController) {
      let ignoreChanges = false

      scope.$watch('ngModel', function(value) {
        if (value != null && !ignoreChanges) {
          return selectAllListController.clearSelectAllState()
        }
      })

      scope.$on('select-all:select', function() {
        if (element.prop('disabled')) {
          return
        }
        ignoreChanges = true
        scope.$apply(() => (scope.ngModel = true))
        return (ignoreChanges = false)
      })

      scope.$on('select-all:deselect', function() {
        if (element.prop('disabled')) {
          return
        }
        ignoreChanges = true
        scope.$apply(() => (scope.ngModel = false))
        return (ignoreChanges = false)
      })

      return scope.$on('select-all:row-clicked', function() {
        if (element.prop('disabled')) {
          return
        }
        ignoreChanges = true
        scope.$apply(function() {
          scope.ngModel = !scope.ngModel
          if (!scope.ngModel) {
            return selectAllListController.clearSelectAllState()
          }
        })
        return (ignoreChanges = false)
      })
    }
  }))

  return App.directive('selectRow', () => ({
    scope: true,
    link(scope, element, attrs) {
      return element.on('click', e =>
        scope.$broadcast('select-all:row-clicked')
      )
    }
  }))
})
