/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let BinaryFilesManager

export default BinaryFilesManager = class BinaryFilesManager {
  constructor(ide, $scope) {
    this.ide = ide
    this.$scope = $scope
    this.$scope.$on('entity:selected', (event, entity) => {
      if (this.$scope.ui.view !== 'track-changes' && entity.type === 'file') {
        return this.openFile(entity)
      } else if (entity.type === 'doc') {
        return this.closeFile()
      }
    })
  }

  openFile(file) {
    this.ide.fileTreeManager.selectEntity(file)
    this.$scope.ui.view = 'file'
    this.$scope.openFile = null
    this.$scope.$apply()
    return window.setTimeout(
      () => {
        this.$scope.openFile = file

        this.$scope.$apply()

        this.$scope.$broadcast('file-view:file-opened')
      },
      0,
      this
    )
  }

  closeFile() {
    return window.setTimeout(
      () => {
        this.$scope.openFile = null
        this.$scope.ui.view = 'editor'
        this.$scope.$apply()
      },
      0,
      this
    )
  }
}
