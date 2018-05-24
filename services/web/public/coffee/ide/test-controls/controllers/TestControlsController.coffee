define [
	"base"
	"ace/ace"
], (App) ->
	App.controller "TestControlsController", ($scope) ->

		$scope.openProjectLinkedFileModal = () ->
			window.openProjectLinkedFileModal()

		$scope.openLinkedFileModal = () ->
			window.openLinkedFileModal()

		$scope.richText = () ->
			window.location.href = window.location.toString() + '&rt=true'
