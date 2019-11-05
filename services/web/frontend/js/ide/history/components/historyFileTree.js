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
  const historyFileTreeController = function($scope, $element, $attrs, _) {
    const ctrl = this
    ctrl.handleEntityClick = file => ctrl.onSelectedFileChange({ file })
    ctrl._fileTree = []

    $scope.$watch('$ctrl.files', function(files) {
      if (files != null && files.length > 0) {
        ctrl._fileTree = _.reduce(files, _reducePathsToTree, [])
      }
    })

    function _reducePathsToTree(currentFileTree, fileObject) {
      const filePathParts = fileObject.pathname.split('/')
      let currentFileTreeLocation = currentFileTree
      for (let index = 0; index < filePathParts.length; index++) {
        var fileTreeEntity
        var pathPart = filePathParts[index]
        const isFile = index === filePathParts.length - 1
        if (isFile) {
          fileTreeEntity = _.clone(fileObject)
          fileTreeEntity.name = pathPart
          fileTreeEntity.type = 'file'
          currentFileTreeLocation.push(fileTreeEntity)
        } else {
          fileTreeEntity = _.find(
            currentFileTreeLocation,
            entity => entity.name === pathPart
          )
          if (fileTreeEntity == null) {
            fileTreeEntity = {
              name: pathPart,
              type: 'folder',
              children: []
            }
            currentFileTreeLocation.push(fileTreeEntity)
          }
          currentFileTreeLocation = fileTreeEntity.children
        }
      }
      return currentFileTree
    }
  }

  return App.component('historyFileTree', {
    bindings: {
      files: '<',
      selectedPathname: '<',
      onSelectedFileChange: '&',
      isLoading: '<'
    },
    controller: historyFileTreeController,
    templateUrl: 'historyFileTreeTpl'
  })
})
