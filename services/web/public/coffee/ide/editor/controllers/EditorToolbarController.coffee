define [
	"base"
	"ide/editor/Document"
], (App, Document) ->
  App.controller "EditorToolbarController", ($scope, ide) ->
    $scope.toggleRichText = () ->
      ide.editorManager.toggleRichText()
