/* eslint-disable
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([], function() {
  let PermissionsManager
  return (PermissionsManager = class PermissionsManager {
    constructor(ide, $scope) {
      this.ide = ide
      this.$scope = $scope
      this.$scope.permissions = {
        read: false,
        write: false,
        admin: false,
        comment: false
      }
      this.$scope.$watch('permissionsLevel', permissionsLevel => {
        if (permissionsLevel != null) {
          if (permissionsLevel === 'readOnly') {
            this.$scope.permissions.read = true
            this.$scope.permissions.comment = true
          } else if (permissionsLevel === 'readAndWrite') {
            this.$scope.permissions.read = true
            this.$scope.permissions.write = true
            this.$scope.permissions.comment = true
          } else if (permissionsLevel === 'owner') {
            this.$scope.permissions.read = true
            this.$scope.permissions.write = true
            this.$scope.permissions.admin = true
            this.$scope.permissions.comment = true
          }
        }

        if (this.$scope.anonymous) {
          return (this.$scope.permissions.comment = false)
        }
      })
    }
  })
})
