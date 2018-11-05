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
  App.controller('HistoryV2FileTreeController', [
    '$scope',
    'ide',
    '_',
    function($scope, ide, _) {
      let _reducePathsToTree
      let _previouslySelectedPathname = null
      $scope.currentFileTree = []

      const _pathnameExistsInFiles = (pathname, files) =>
        _.any(files, file => file.pathname === pathname)

      const _getSelectedDefaultPathname = function(files) {
        let selectedPathname = null
        if (
          _previouslySelectedPathname != null &&
          _pathnameExistsInFiles(_previouslySelectedPathname, files)
        ) {
          selectedPathname = _previouslySelectedPathname
        } else {
          const mainFile = _.find(files, file =>
            /main\.tex$/.test(file.pathname)
          )
          if (mainFile != null) {
            selectedPathname = _previouslySelectedPathname = mainFile.pathname
          } else {
            selectedPathname = _previouslySelectedPathname = files[0].pathname
          }
        }
        return selectedPathname
      }

      $scope.handleFileSelection = file =>
        ($scope.history.selection.pathname = _previouslySelectedPathname =
          file.pathname)

      $scope.$watch('history.files', function(files) {
        if (files != null && files.length > 0) {
          $scope.currentFileTree = _.reduce(files, _reducePathsToTree, [])
          return ($scope.history.selection.pathname = _getSelectedDefaultPathname(
            files
          ))
        }
      })

      return (_reducePathsToTree = function(currentFileTree, fileObject) {
        const filePathParts = fileObject.pathname.split('/')
        let currentFileTreeLocation = currentFileTree
        for (let index = 0; index < filePathParts.length; index++) {
          var fileTreeEntity
          var pathPart = filePathParts[index]
          const isFile = index === filePathParts.length - 1
          if (isFile) {
            fileTreeEntity = {
              name: pathPart,
              pathname: fileObject.pathname,
              type: 'file',
              operation: fileObject.operation || 'edited'
            }
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
      })
    }
  ]))
