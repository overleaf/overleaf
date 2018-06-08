define [
	"base"
	"ace/ace"
], (App) ->
	App.controller "TestControlsController", ($scope) ->

		$scope.openProjectLinkedFileModal = () ->
			window.openProjectLinkedFileModal()

		$scope.openProjectOutputLinkedFileModal = () ->
			window.openProjectOutputLinkedFileModal()

		$scope.openLinkedFileModal = () ->
			window.openLinkedFileModal()

		$scope.richText = () ->
			current = window.location.toString()
			target = "#{current}#{if window.location.search then '&' else '?'}rt=true"
			window.location.href = target
